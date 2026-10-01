const router = require('express').Router();
const { body, query: q } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const { success, created, paginated, error } = require('../utils/responseHelper');

// POST /api/v1/stock/entries
// StockHolder creates entry WITHOUT funding_head or asset_head — those are classified by Admin later
router.post(
  '/entries',
  authorize('StockHolder'),
  [
    body('ledger_type').isIn(['CS24', 'CS24A']),
    body('entry_type').isIn(['RECEIPT', 'ISSUE', 'RETURN', 'WRITE_OFF', 'ADJUSTMENT', 'OPENING']),
    body('operational_department_id').isInt(),
    body('financial_year').notEmpty(), body('entry_date').isDate(),
    body('item_description').notEmpty(),
    body('quantity').isFloat({ gt: 0 }), body('amount').isFloat({ min: 0 }),
    body('stock_volume_no').isInt(),
    body('is_donation').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const b = req.body;
      const { rows } = await db.query(
        `INSERT INTO stock_ledger
         (ledger_type, entry_type, is_consumable, operational_department_id,
          financial_year, stock_volume_no, stock_page_no, entry_date, item_description, machine_no, code_no,
          voucher_no, cheque_no, supplier_id, bill_no, bill_date,
          quantity, rate, amount, location_id, in_charge_id,
          sanction_no, sanction_date, remarks, created_by, classification_status, is_donation, vidyalaya_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
         RETURNING *`,
        [
          b.ledger_type, b.entry_type, b.ledger_type === 'CS24A',
          b.operational_department_id, b.financial_year, b.stock_volume_no, b.stock_page_no, b.entry_date,
          b.item_description, b.machine_no, b.code_no,
          b.voucher_no, b.cheque_no, b.supplier_id, b.bill_no, b.bill_date,
          b.quantity, b.rate, b.amount, b.location_id, b.in_charge_id,
          b.sanction_no, b.sanction_date, b.remarks, req.user.id, 'PENDING', b.is_donation || false, vid
        ]
      );
      created(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// PUT /api/v1/stock/entries/:id/classify  — Admin classifies a pending entry
router.put(
  '/entries/:id/classify',
  authorize('Admin'),
  [
    body('funding_head_id').isInt(),
    body('asset_head_id').optional({ nullable: true }).isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const { funding_head_id, asset_head_id } = req.body;
      const entryId = req.params.id;

      // Fetch entry
      const { rows: existing } = await db.query('SELECT * FROM stock_ledger WHERE id = $1 AND vidyalaya_id = $2', [entryId, vid]);
      if (existing.length === 0) return error(res, 'Stock entry not found', 404);
      const entry = existing[0];

      if (entry.classification_status === 'CLASSIFIED') {
        return error(res, 'Entry is already classified', 400);
      }

      // Validation: CS24 requires asset_head_id, CS24A must NOT have it
      if (entry.ledger_type === 'CS24' && !asset_head_id) {
        return error(res, 'Asset Head is required for CS24 entries', 400);
      }
      if (entry.ledger_type === 'CS24A' && asset_head_id) {
        return error(res, 'Asset Head must not be set for CS24A (consumable) entries', 400);
      }

      const { rows } = await db.query(
        `UPDATE stock_ledger
         SET funding_head_id = $1, department_id = $2, classification_status = 'CLASSIFIED', updated_at = NOW()
         WHERE id = $3 AND vidyalaya_id = $4
         RETURNING *`,
        [funding_head_id, asset_head_id || null, entryId, vid]
      );

      success(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// GET /api/v1/stock/entries
router.get('/entries', authorize('StockHolder', 'Admin', 'Principal'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { asset_head_id, operational_dept_id, fund_id, fy, type, ledger_type, classification_status, page = 1, limit = 50 } = req.query;
    let sql = `SELECT sl.*, fh.code AS fund_code, d.code AS asset_head_code, s.name AS supplier_name,
                      od.name AS operational_dept_name,
                      uc.name AS created_by_name, uc.employee_code AS created_by_empcode
               FROM stock_ledger sl
               LEFT JOIN funding_head fh ON fh.id = sl.funding_head_id
               LEFT JOIN department d ON d.id = sl.department_id
               LEFT JOIN operational_department od ON od.id = sl.operational_department_id
               LEFT JOIN supplier s ON s.id = sl.supplier_id
               LEFT JOIN "user" uc ON uc.id = sl.created_by`;
    const params = [vid];
    const where = ['sl.vidyalaya_id = $1'];

    if (asset_head_id) { params.push(asset_head_id); where.push(`sl.department_id = $${params.length}`); }
    if (operational_dept_id) { params.push(operational_dept_id); where.push(`sl.operational_department_id = $${params.length}`); }
    if (fund_id) { params.push(fund_id); where.push(`sl.funding_head_id = $${params.length}`); }
    if (fy) { params.push(fy); where.push(`sl.financial_year = $${params.length}`); }
    if (type) { params.push(type); where.push(`sl.entry_type = $${params.length}`); }
    if (ledger_type) { params.push(ledger_type); where.push(`sl.ledger_type = $${params.length}`); }
    if (classification_status) { params.push(classification_status); where.push(`sl.classification_status = $${params.length}`); }

    sql += ' WHERE ' + where.join(' AND ');

    // Count
    const countSql = sql.replace(/SELECT [\s\S]*? FROM/i, 'SELECT COUNT(*) FROM');
    const { rows: countRows } = await db.query(countSql, params);
    const total = parseInt(countRows[0].count, 10);

    sql += ' ORDER BY sl.entry_date DESC, sl.id DESC';
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await db.query(sql, params);
    paginated(res, rows, total, page, limit);
  } catch (err) { next(err); }
});

// GET /api/v1/stock/entries/:id
router.get('/entries/:id', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { rows } = await db.query(
      `SELECT sl.*, uc.name AS created_by_name, uc.employee_code AS created_by_empcode
       FROM stock_ledger sl
       LEFT JOIN "user" uc ON uc.id = sl.created_by
       WHERE sl.id = $1 AND sl.vidyalaya_id = $2`, [req.params.id, vid]);
    if (rows.length === 0) return error(res, 'Stock entry not found', 404);
    success(res, rows[0]);
  } catch (err) { next(err); }
});

// GET /api/v1/stock/balance
router.get('/balance', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { asset_head_id, operational_dept_id, fund_id, item, ledger_type } = req.query;
    let sql = `SELECT item_description, balance_after, ledger_type
               FROM stock_ledger
               WHERE classification_status = 'CLASSIFIED'
                 AND item_description ILIKE $1 AND ledger_type = $2 AND vidyalaya_id = $3`;
    const params = [`%${item}%`, ledger_type || 'CS24', vid];
    
    if (fund_id) { params.push(fund_id); sql += ` AND funding_head_id = $${params.length}`; }
    if (asset_head_id) { params.push(asset_head_id); sql += ` AND department_id = $${params.length}`; }
    if (operational_dept_id) { params.push(operational_dept_id); sql += ` AND operational_department_id = $${params.length}`; }
    
    sql += ` ORDER BY entry_date DESC, id DESC LIMIT 1`;
    
    const { rows } = await db.query(sql, params);
    success(res, rows[0] || { balance: 0 });
  } catch (err) { next(err); }
});

// POST /api/v1/stock/write-off
router.post(
  '/write-off',
  authorize('Admin'),
  [body('stock_entry_id').isInt(), body('sanction_no').notEmpty(), body('sanction_date').isDate()],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      // Get original entry to create write-off
      const { rows: orig } = await db.query('SELECT * FROM stock_ledger WHERE id = $1 AND vidyalaya_id = $2', [req.body.stock_entry_id, vid]);
      if (orig.length === 0) return error(res, 'Stock entry not found', 404);
      const o = orig[0];

      if (o.classification_status !== 'CLASSIFIED') {
        return error(res, 'Cannot write-off an unclassified entry', 400);
      }

      const { rows } = await db.query(
        `INSERT INTO stock_ledger
         (ledger_type, entry_type, is_consumable, funding_head_id, department_id, operational_department_id,
          financial_year, entry_date, item_description, machine_no, code_no,
          quantity, rate, amount, location_id, in_charge_id,
          sanction_no, sanction_date, remarks, created_by, classification_status, vidyalaya_id)
         VALUES ($1, 'WRITE_OFF', $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'CLASSIFIED', $19)
         RETURNING *`,
        [
          o.ledger_type, o.is_consumable, o.funding_head_id, o.department_id, o.operational_department_id,
          o.financial_year, o.item_description, o.machine_no, o.code_no,
          o.quantity, o.rate, o.amount, o.location_id, o.in_charge_id,
          req.body.sanction_no, req.body.sanction_date,
          `Write-off of stock entry #${o.id}`, req.user.id, vid
        ]
      );
      created(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// POST /api/v1/stock/transfer
router.post(
  '/transfer',
  authorize('StockHolder'),
  [body('entry_ids').isArray({ min: 1 }), body('new_in_charge_id').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const { entry_ids, new_in_charge_id, remarks } = req.body;
      const { rowCount } = await db.query(
        `UPDATE stock_ledger SET in_charge_id = $1, remarks = COALESCE(remarks, '') || ' | Transfer: ' || $2, updated_at = NOW()
         WHERE id = ANY($3) AND vidyalaya_id = $4`,
        [new_in_charge_id, remarks || '', entry_ids, vid]
      );
      success(res, { transferred: rowCount });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/stock/register  — CS-24 / CS-24A register view
router.get('/register', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { asset_head_id, operational_dept_id, fund_id, fy, ledger_type, item } = req.query;
    let sql = `SELECT sl.*,
                      fh.code AS fund_code, d.code AS asset_head_code, od.name AS operational_dept_name,
                      s.name AS supplier_name,
                      u_teacher.name AS teacher_name, u_teacher.employee_code AS teacher_empcode,
                      u_principal.name AS principal_name, u_principal.employee_code AS principal_empcode,
                      uc.name AS created_by_name, uc.employee_code AS created_by_empcode
               FROM stock_ledger sl
               LEFT JOIN funding_head fh ON fh.id = sl.funding_head_id
               LEFT JOIN department d ON d.id = sl.department_id
               LEFT JOIN operational_department od ON od.id = sl.operational_department_id
               LEFT JOIN supplier s ON s.id = sl.supplier_id
               LEFT JOIN "user" u_teacher ON u_teacher.id = sl.in_charge_id
               LEFT JOIN "user" u_principal ON u_principal.id = sl.verified_by
               LEFT JOIN "user" uc ON uc.id = sl.created_by`;
    const params = [vid];
    const where = ['sl.vidyalaya_id = $1', 'sl.classification_status = \'CLASSIFIED\''];

    if (asset_head_id) { params.push(asset_head_id); where.push(`sl.department_id = $${params.length}`); }
    if (operational_dept_id) { params.push(operational_dept_id); where.push(`sl.operational_department_id = $${params.length}`); }
    if (fund_id) { params.push(fund_id); where.push(`sl.funding_head_id = $${params.length}`); }
    if (fy) { params.push(fy); where.push(`sl.financial_year = $${params.length}`); }
    if (ledger_type) { params.push(ledger_type); where.push(`sl.ledger_type = $${params.length}`); }
    if (item) { params.push(`%${item}%`); where.push(`sl.item_description ILIKE $${params.length}`); }

    sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY sl.item_description, sl.entry_date ASC, sl.id ASC';

    const { rows } = await db.query(sql, params);

    // Group by item_description for register format
    const grouped = {};
    for (const row of rows) {
      const key = row.item_description;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }

    success(res, { entries: rows, grouped });
  } catch (err) { next(err); }
});

module.exports = router;
