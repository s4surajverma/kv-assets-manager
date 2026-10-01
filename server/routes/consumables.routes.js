const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const { success, created, error } = require('../utils/responseHelper');

// POST /api/v1/consumables/issue
router.post('/issue', authorize('StockHolder'),
  [body('stock_ledger_id').isInt(), body('issued_to').isInt(), body('quantity').isFloat({ gt: 0 }), body('purpose').notEmpty()],
  validate,
  async (req, res, next) => {
    const client = await db.getTenantClient();
    try {
      await client.query('BEGIN');
      const vid = req.user.vidyalaya_id;
      const { stock_ledger_id, issued_to, quantity, purpose } = req.body;

      const { rows: sl } = await client.query(
        'SELECT * FROM stock_ledger WHERE id = $1 AND vidyalaya_id = $2', [stock_ledger_id, vid]
      );
      if (sl.length === 0) return error(res, 'Stock entry not found', 404);
      if (sl[0].ledger_type !== 'CS24A') return error(res, 'Only CS-24A entries can be issued as consumables', 400);

      await client.query(
        `INSERT INTO stock_ledger
         (ledger_type, entry_type, is_consumable, funding_head_id, department_id,
          financial_year, entry_date, item_description, quantity, rate, amount, created_by, vidyalaya_id)
         VALUES ('CS24A', 'ISSUE', true, $1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)`,
        [
          sl[0].funding_head_id, sl[0].department_id, sl[0].financial_year,
          sl[0].item_description, quantity, sl[0].rate, +(quantity * (sl[0].rate || 0)).toFixed(2),
          req.user.id, vid
        ]
      );

      const { rows } = await client.query(
        `INSERT INTO consumable_issue (stock_ledger_id, issued_to, issued_by, issue_date, quantity, purpose, vidyalaya_id)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6) RETURNING *`,
        [stock_ledger_id, issued_to, req.user.id, quantity, purpose, vid]
      );

      await client.query('COMMIT');
      created(res, rows[0]);
    } catch (e) { await client.query('ROLLBACK'); next(e); }
    finally { client.release(); }
  }
);

// POST /api/v1/consumables/return
router.post('/return', authorize('StockHolder'),
  [body('issue_id').isInt(), body('returned_qty').isFloat({ gt: 0 })],
  validate,
  async (req, res, next) => {
    const client = await db.getTenantClient();
    try {
      await client.query('BEGIN');
      const vid = req.user.vidyalaya_id;
      const { issue_id, returned_qty } = req.body;

      const { rows: ci } = await client.query(
        `SELECT ci.*, sl.* FROM consumable_issue ci
         JOIN stock_ledger sl ON sl.id = ci.stock_ledger_id
         WHERE ci.id = $1 AND ci.vidyalaya_id = $2`,
        [issue_id, vid]
      );
      if (ci.length === 0) return error(res, 'Issue record not found', 404);

      await client.query(
        `INSERT INTO stock_ledger
         (ledger_type, entry_type, is_consumable, funding_head_id, department_id,
          financial_year, entry_date, item_description, quantity, rate, amount, created_by, vidyalaya_id)
         VALUES ('CS24A', 'RETURN', true, $1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)`,
        [
          ci[0].funding_head_id, ci[0].department_id, ci[0].financial_year,
          ci[0].item_description, returned_qty, ci[0].rate || 0,
          +(returned_qty * (ci[0].rate || 0)).toFixed(2), req.user.id, vid
        ]
      );

      const { rows } = await client.query(
        `UPDATE consumable_issue SET returned_qty = returned_qty + $1, return_date = NOW()
         WHERE id = $2 AND vidyalaya_id = $3 RETURNING *`,
        [returned_qty, issue_id, vid]
      );

      await client.query('COMMIT');
      success(res, rows[0]);
    } catch (e) { await client.query('ROLLBACK'); next(e); }
    finally { client.release(); }
  }
);

// PUT /api/v1/consumables/:id/attest
router.put('/:id/attest', authorize('StockHolder'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { rows } = await db.query(
      'UPDATE consumable_issue SET attested_by = $1 WHERE id = $2 AND vidyalaya_id = $3 RETURNING *',
      [req.user.id, req.params.id, vid]
    );
    if (rows.length === 0) return error(res, 'Not found', 404);
    success(res, rows[0]);
  } catch (err) { next(err); }
});

// GET /api/v1/consumables
router.get('/', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { dept_id, fund_id, from, to, issued_to } = req.query;
    let sql = `SELECT ci.*, sl.item_description, u.name AS issued_to_name, u.employee_code AS issued_to_empcode
               FROM consumable_issue ci
               JOIN stock_ledger sl ON sl.id = ci.stock_ledger_id
               JOIN "user" u ON u.id = ci.issued_to`;
    const params = [vid];
    const where = ['ci.vidyalaya_id = $1'];
    if (dept_id) { params.push(dept_id); where.push(`sl.department_id = $${params.length}`); }
    if (fund_id) { params.push(fund_id); where.push(`sl.funding_head_id = $${params.length}`); }
    if (from) { params.push(from); where.push(`ci.issue_date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`ci.issue_date <= $${params.length}`); }
    if (issued_to) { params.push(issued_to); where.push(`ci.issued_to = $${params.length}`); }
    sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY ci.issue_date DESC';
    const { rows } = await db.query(sql, params);
    success(res, rows);
  } catch (err) { next(err); }
});

// GET /api/v1/consumables/active-issues
router.get('/active-issues', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { rows } = await db.query(
      `SELECT ci.*, sl.item_description, u.name AS issued_to_name, u.employee_code AS issued_to_empcode,
              (ci.quantity - COALESCE(ci.returned_qty, 0)) AS max_returnable
       FROM consumable_issue ci
       JOIN stock_ledger sl ON sl.id = ci.stock_ledger_id
       JOIN "user" u ON u.id = ci.issued_to
       WHERE ci.vidyalaya_id = $1 AND (ci.quantity - COALESCE(ci.returned_qty, 0)) > 0
       ORDER BY ci.issue_date DESC`,
      [vid]
    );
    success(res, rows);
  } catch (err) { next(err); }
});

// GET /api/v1/consumables/available-stock
router.get('/available-stock', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    // Get all CS24A receipts and calculate remaining balance (received - issued + returned)
    const { rows } = await db.query(
      `SELECT sl.id as stock_ledger_id, sl.item_description, sl.quantity as received_qty,
              COALESCE((SELECT SUM(ci.quantity) FROM consumable_issue ci WHERE ci.stock_ledger_id = sl.id AND ci.vidyalaya_id = $1), 0) as issued_qty,
              COALESCE((SELECT SUM(ci.returned_qty) FROM consumable_issue ci WHERE ci.stock_ledger_id = sl.id AND ci.vidyalaya_id = $1), 0) as returned_qty
       FROM stock_ledger sl
       WHERE sl.ledger_type = 'CS24A' AND sl.entry_type = 'RECEIPT' AND sl.vidyalaya_id = $1
       ORDER BY sl.item_description ASC, sl.entry_date DESC`,
      [vid]
    );
    
    // Filter to only items with a positive remaining balance
    const available = rows.map(r => {
      const remaining = Number(r.received_qty) - Number(r.issued_qty) + Number(r.returned_qty);
      return { ...r, remaining_balance: remaining };
    }).filter(r => r.remaining_balance > 0);
    
    success(res, available);
  } catch (err) { next(err); }
});

// GET /api/v1/consumables/balance
router.get('/balance', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { item, dept_id, fund_id } = req.query;
    const { rows } = await db.query(
      `SELECT item_description, balance_after AS current_balance,
              (SELECT COALESCE(SUM(ci.quantity),0) FROM consumable_issue ci
               JOIN stock_ledger sl2 ON sl2.id = ci.stock_ledger_id
               WHERE sl2.item_description = sl.item_description
                 AND sl2.department_id = sl.department_id AND ci.vidyalaya_id = $4) AS total_issued,
              (SELECT COALESCE(SUM(ci.returned_qty),0) FROM consumable_issue ci
               JOIN stock_ledger sl2 ON sl2.id = ci.stock_ledger_id
               WHERE sl2.item_description = sl.item_description
                 AND sl2.department_id = sl.department_id AND ci.vidyalaya_id = $4) AS total_returned
       FROM stock_ledger sl
       WHERE sl.department_id = $1 AND sl.funding_head_id = $2
         AND sl.item_description ILIKE $3 AND sl.ledger_type = 'CS24A' AND sl.vidyalaya_id = $4
       ORDER BY sl.entry_date DESC, sl.id DESC LIMIT 1`,
      [dept_id, fund_id, `%${item}%`, vid]
    );
    success(res, rows[0] || { current_balance: 0, total_issued: 0, total_returned: 0 });
  } catch (err) { next(err); }
});

module.exports = router;
