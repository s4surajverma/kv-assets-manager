const router = require('express').Router();
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const fyUtils = require('../utils/financialYear');
const { success } = require('../utils/responseHelper');

// GET /api/v1/reports/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const fy = fyUtils.current();
    const [assets, value, depr, pending, overdue] = await Promise.all([
      db.query("SELECT COUNT(*) AS cnt FROM asset WHERE status = 'ACTIVE' AND vidyalaya_id = $1", [vid]),
      db.query("SELECT COALESCE(SUM(total_cost),0) AS val FROM asset WHERE status = 'ACTIVE' AND vidyalaya_id = $1", [vid]),
      db.query('SELECT COALESCE(SUM(depreciation_amount),0) AS val FROM depreciation_ledger WHERE financial_year = $1 AND vidyalaya_id = $2', [fy, vid]),
      db.query("SELECT COUNT(*) AS cnt FROM condemnation_entry WHERE status IN ('PENDING','BOARD_REVIEWED') AND vidyalaya_id = $1", [vid]),
      db.query(
        `SELECT COUNT(*) AS cnt FROM verification
         WHERE status != 'COMPLETED' AND vidyalaya_id = $1`, [vid]
      ),
    ]);

    const pendingVerifs = parseInt(overdue.rows[0].cnt, 10);

    success(res, {
      financial_year: fy,
      total_assets: parseInt(assets.rows[0].cnt, 10),
      total_value: parseFloat(value.rows[0].val),
      depreciation_this_year: parseFloat(depr.rows[0].val),
      pending_condemnations: parseInt(pending.rows[0].cnt, 10),
      pending_verifications: pendingVerifs,
      overdue_verifications: pendingVerifs,
    });
  } catch (err) { next(err); }
});

// GET /api/v1/reports/assets-by-department
router.get('/assets-by-department', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { rows } = await db.query(
      `SELECT d.code, d.name, COUNT(*) AS count,
              SUM(a.total_cost) AS total_cost, SUM(a.book_value) AS total_book_value
       FROM asset a JOIN department d ON d.id = a.department_id
       WHERE a.status = 'ACTIVE' AND a.vidyalaya_id = $1 GROUP BY d.code, d.name ORDER BY d.code`, [vid]
    );
    success(res, rows);
  } catch (err) { next(err); }
});

// GET /api/v1/reports/assets-by-fund
router.get('/assets-by-fund', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { rows } = await db.query(
      `SELECT fh.code, fh.name, COUNT(*) AS count,
              SUM(a.total_cost) AS total_cost, SUM(a.book_value) AS total_book_value
       FROM asset a JOIN funding_head fh ON fh.id = a.funding_head_id
       WHERE a.status = 'ACTIVE' AND a.vidyalaya_id = $1 GROUP BY fh.code, fh.name ORDER BY fh.code`, [vid]
    );
    success(res, rows);
  } catch (err) { next(err); }
});

module.exports = router;
