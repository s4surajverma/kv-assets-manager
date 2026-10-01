const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const { success, created, error } = require('../utils/responseHelper');

// ============================================================
// POST /api/v1/verifications — Create new verification
// ============================================================
router.post('/', authorize('Admin'),
  [body('financial_year').notEmpty(), body('operational_department_id').isInt(), body('custodian_employee_code').notEmpty().withMessage('Stock Holder Employee Code is required')],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const { financial_year, operational_department_id, custodian_employee_code } = req.body;

      // Resolve employee_code to user id
      const { rows: custodianRows } = await db.query(
        'SELECT id FROM "user" WHERE employee_code = $1 AND vidyalaya_id = $2 AND is_active = true AND is_deleted = false',
        [custodian_employee_code, vid]
      );
      if (custodianRows.length === 0) return error(res, `No active user found with employee code: ${custodian_employee_code}`, 400);
      const custodian_id = custodianRows[0].id;

      const client = await db.getTenantClient();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `INSERT INTO verification (financial_year, operational_department_id, verification_date, verified_by, custodian_id, vidyalaya_id)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [financial_year, operational_department_id, new Date(), req.user.id, custodian_id, vid]
        );
        const verification = rows[0];

        // Auto-generate checklist from active assets in this operational department
        const { rows: assets } = await client.query(
          `SELECT id, total_units FROM asset
           WHERE operational_department_id = $1 AND status = 'ACTIVE' AND vidyalaya_id = $2 ORDER BY asset_number`,
          [operational_department_id, vid]
        );
        for (const asset of assets) {
          await client.query(
            `INSERT INTO verification_item (verification_id, asset_id, stock_qty, physical_qty, condition)
             VALUES ($1, $2, $3, 0, 'GOOD')`,
            [verification.id, asset.id, asset.total_units]
          );
        }
        await client.query('COMMIT');
        const { rows: items } = await db.query(
          'SELECT * FROM verification_item WHERE verification_id = $1', [verification.id]
        );
        success(res, { verification, checklist: items }, 201);
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
    } catch (err) { next(err); }
  }
);

// ============================================================
// GET /api/v1/verifications — List verifications
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { fy, operational_department_id, status } = req.query;
    let sql = `SELECT v.*,
                      COALESCE(od.code, d.code) AS dept_code,
                      COALESCE(od.name, d.name) AS dept_name,
                      u.name AS verified_by_name
               FROM verification v
               LEFT JOIN operational_department od ON od.id = v.operational_department_id
               LEFT JOIN department d ON d.id = v.department_id
               JOIN "user" u ON u.id = v.verified_by`;
    const params = [vid];
    const where = ['v.vidyalaya_id = $1'];
    if (fy) { params.push(fy); where.push(`v.financial_year = $${params.length}`); }
    if (operational_department_id) { params.push(operational_department_id); where.push(`v.operational_department_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`v.status = $${params.length}`); }
    sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY v.created_at DESC';
    const { rows } = await db.query(sql, params);
    success(res, rows);
  } catch (err) { next(err); }
});

// ============================================================
// GET /api/v1/verifications/:id/items — Get ALL items for execute page
// ============================================================
router.get('/:id/items', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    // First verify ownership
    const { rows: vRows } = await db.query(
      'SELECT id FROM verification WHERE id = $1 AND vidyalaya_id = $2',
      [req.params.id, vid]
    );
    if (vRows.length === 0) return error(res, 'Verification not found', 404);

    // verification_item is a global table, but we JOIN with asset (tenant table)
    // Use rawQuery since verification_item has no vidyalaya_id column
    const { rows } = await db.rawQuery(
      `SELECT vi.*, a.asset_number, a.name AS asset_name
       FROM verification_item vi
       JOIN asset a ON a.id = vi.asset_id
       WHERE vi.verification_id = $1
       ORDER BY a.asset_number`,
      [req.params.id]
    );
    success(res, rows);
  } catch (err) { next(err); }
});

// ============================================================
// PUT /api/v1/verifications/:id/items — Update verification items
// ============================================================
router.put('/:id/items', authorize('StockHolder'),
  [body('items').isArray({ min: 1 })], validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      // Verify ownership first
      const { rows: vRows } = await db.query(
        'SELECT id FROM verification WHERE id = $1 AND vidyalaya_id = $2',
        [req.params.id, vid]
      );
      if (vRows.length === 0) return error(res, 'Verification not found', 404);

      // verification_item is a global table — use rawQuery for updates
      for (const item of req.body.items) {
        await db.rawQuery(
          `UPDATE verification_item SET physical_qty = $1, condition = $2, remarks = $3
           WHERE verification_id = $4 AND asset_id = $5`,
          [item.physical_qty, item.condition, item.remarks, req.params.id, item.asset_id]
        );
      }
      // Fetch updated items
      const { rows } = await db.rawQuery(
        `SELECT vi.*, a.asset_number, a.name AS asset_name
         FROM verification_item vi
         JOIN asset a ON a.id = vi.asset_id
         WHERE vi.verification_id = $1
         ORDER BY a.asset_number`,
        [req.params.id]
      );
      success(res, rows);
    } catch (e) { next(e); }
  }
);

// ============================================================
// POST /api/v1/verifications/:id/complete — Complete verification
// ============================================================
router.post('/:id/complete', authorize('Admin'),
  [body('certificate_text').notEmpty()], validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      // Check for discrepancies (verification_item is global — use rawQuery)
      const { rows: disc } = await db.rawQuery(
        'SELECT COUNT(*) AS cnt FROM verification_item WHERE verification_id = $1 AND physical_qty != stock_qty',
        [req.params.id]
      );
      const hasDisc = parseInt(disc[0].cnt, 10) > 0;
      const newStatus = hasDisc ? 'DISCREPANCIES_FOUND' : 'COMPLETED';

      const { rows } = await db.query(
        `UPDATE verification SET status = $1, certificate_text = $2
         WHERE id = $3 AND vidyalaya_id = $4 RETURNING *`,
        [newStatus, req.body.certificate_text, req.params.id, vid]
      );
      if (rows.length === 0) return error(res, 'Verification not found', 404);
      success(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// ============================================================
// GET /api/v1/verifications/:id/discrepancies
// ============================================================
router.get('/:id/discrepancies', authorize('Admin'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    // Verify ownership
    const { rows: vRows } = await db.query(
      'SELECT id FROM verification WHERE id = $1 AND vidyalaya_id = $2',
      [req.params.id, vid]
    );
    if (vRows.length === 0) return error(res, 'Verification not found', 404);

    const { rows } = await db.rawQuery(
      `SELECT vi.*, a.asset_number, a.name AS asset_name
       FROM verification_item vi
       JOIN asset a ON a.id = vi.asset_id
       WHERE vi.verification_id = $1 AND vi.physical_qty != vi.stock_qty`,
      [req.params.id]
    );
    success(res, rows);
  } catch (err) { next(err); }
});

// ============================================================
// GET /api/v1/verifications/overdue/list
// ============================================================
router.get('/overdue/list', authorize('Admin'), async (req, res, next) => {
  try {
    const fy = req.query.fy || require('../utils/financialYear').current();
    const vid = req.user.vidyalaya_id;
    const { rows } = await db.query(
      `SELECT od.id, od.code, od.name,
              v.verification_date AS last_verified,
              CURRENT_DATE - COALESCE(v.verification_date, '2000-01-01'::date) AS days_since
       FROM operational_department od
       LEFT JOIN verification v ON v.operational_department_id = od.id AND v.financial_year = $1 AND v.vidyalaya_id = $2
       WHERE od.vidyalaya_id = $2 AND (v.id IS NULL OR v.status != 'COMPLETED')
       ORDER BY od.code`,
      [fy, vid]
    );
    success(res, rows);
  } catch (err) { next(err); }
});

// ============================================================
// GET /api/v1/verifications/:id/report — Full report data
// ============================================================
router.get('/:id/report', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;

    // 1. Get header info
    const { rows: vRows } = await db.query(
      `SELECT v.id, v.financial_year, v.verification_date, v.status,
              vid.kv_name_en, vid.kv_name_hi, vid.kv_code,
              COALESCE(od.name, d.name) AS dept_name,
              u_veri.name AS verified_by_name, u_veri.employee_code AS verified_by_empcode,
              u_cust.name AS custodian_name, u_cust.employee_code AS custodian_empcode
       FROM verification v
       JOIN vidyalaya vid ON vid.id = v.vidyalaya_id
       LEFT JOIN operational_department od ON od.id = v.operational_department_id
       LEFT JOIN department d ON d.id = v.department_id
       LEFT JOIN "user" u_veri ON u_veri.id = v.verified_by
       LEFT JOIN "user" u_cust ON u_cust.id = v.custodian_id
       WHERE v.id = $1 AND v.vidyalaya_id = $2`,
      [req.params.id, vid]
    );

    if (vRows.length === 0) return error(res, 'Verification not found', 404);
    const verification = vRows[0];

    // 2. Get items with volume and page no
    const { rows: items } = await db.rawQuery(
      `SELECT vi.*, a.asset_number, a.name AS asset_name,
              sl.stock_volume_no, sl.stock_page_no
       FROM verification_item vi
       JOIN asset a ON a.id = vi.asset_id
       LEFT JOIN stock_ledger sl ON sl.id = a.stock_ledger_id
       WHERE vi.verification_id = $1
       ORDER BY a.asset_number`,
      [req.params.id]
    );

    // 3. Calculate volume ranges based on items in this verification
    const { rows: volumeRanges } = await db.rawQuery(
      `SELECT 
         sl.ledger_type,
         COALESCE(sl.stock_volume_no, 1) as volume_no, 
         MIN(sl.stock_page_no) as start_page, 
         MAX(sl.stock_page_no) as end_page
       FROM verification_item vi
       JOIN asset a ON a.id = vi.asset_id
       JOIN stock_ledger sl ON sl.id = a.stock_ledger_id
       WHERE vi.verification_id = $1 AND sl.stock_page_no IS NOT NULL
       GROUP BY sl.ledger_type, COALESCE(sl.stock_volume_no, 1)
       ORDER BY sl.ledger_type DESC, volume_no ASC`,
      [req.params.id]
    );

    success(res, { verification, items, volumeRanges });
  } catch (err) { next(err); }
});

module.exports = router;
