const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const { success, error } = require('../utils/responseHelper');

// Helper to calculate current Indian FY code (Apr 1 - Mar 31)
const getCalendarFY = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 3 = Apr
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
};

// Helper to count records referencing a financial year
const countFyRecords = async (code) => {
  const [stock, depr, ce, cm, sanc, verif, obs] = await Promise.all([
    db.rawQuery('SELECT COUNT(*) AS c FROM stock_ledger WHERE financial_year = $1', [code]).catch(() => ({ rows: [{ c: 0 }] })),
    db.rawQuery('SELECT COUNT(*) AS c FROM depreciation_ledger WHERE financial_year = $1', [code]).catch(() => ({ rows: [{ c: 0 }] })),
    db.rawQuery('SELECT COUNT(*) AS c FROM condemnation_entry WHERE financial_year = $1', [code]).catch(() => ({ rows: [{ c: 0 }] })),
    db.rawQuery('SELECT COUNT(*) AS c FROM condemnation_master WHERE financial_year = $1', [code]).catch(() => ({ rows: [{ c: 0 }] })),
    db.rawQuery('SELECT COUNT(*) AS c FROM sanction WHERE financial_year = $1', [code]).catch(() => ({ rows: [{ c: 0 }] })),
    db.rawQuery('SELECT COUNT(*) AS c FROM verification WHERE financial_year = $1', [code]).catch(() => ({ rows: [{ c: 0 }] })),
    db.rawQuery('SELECT COUNT(*) AS c FROM opening_balance_snapshot WHERE financial_year = $1', [code]).catch(() => ({ rows: [{ c: 0 }] })),
  ]);

  const breakdown = {
    stock: parseInt(stock.rows[0]?.c || 0, 10),
    depreciation: parseInt(depr.rows[0]?.c || 0, 10),
    condemnations: parseInt(ce.rows[0]?.c || 0, 10) + parseInt(cm.rows[0]?.c || 0, 10),
    sanctions: parseInt(sanc.rows[0]?.c || 0, 10),
    verifications: parseInt(verif.rows[0]?.c || 0, 10),
    opening_balance: parseInt(obs.rows[0]?.c || 0, 10),
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { total, breakdown };
};

// GET /api/v1/financial-years
router.get('/', async (req, res, next) => {
  try {
    const includeAll = req.query.include_all === 'true' || req.query.all === 'true';
    const query = includeAll
      ? 'SELECT * FROM financial_year ORDER BY start_date DESC'
      : 'SELECT * FROM financial_year WHERE COALESCE(is_system_generated, false) = false ORDER BY start_date DESC';
    const { rows } = await db.query(query);
    const currentCode = getCalendarFY();

    const enriched = await Promise.all(
      rows.map(async (r) => {
        const { total, breakdown } = await countFyRecords(r.code);
        return {
          ...r,
          is_current: r.code === currentCode,
          record_count: total,
          records_breakdown: breakdown,
          can_delete: total === 0,
        };
      })
    );
    success(res, enriched);
  } catch (err) { next(err); }
});

// POST /api/v1/financial-years (Admin creates a new FY manually)
router.post('/', authorize('Admin'),
  [
    body('code').matches(/^\d{4}-\d{2}$/).withMessage('Code must be in format YYYY-YY (e.g. 2026-27)'),
    body('remarks').optional().isString()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { code, remarks } = req.body;
      const startYear = parseInt(code.split('-')[0], 10);
      const expectedEnd = String(startYear + 1).slice(2);
      if (code.split('-')[1] !== expectedEnd) {
        return error(res, `Invalid code format: For ${startYear}, end year suffix must be ${expectedEnd}`, 400);
      }
      const startDate = `${startYear}-04-01`;
      const endDate = `${startYear + 1}-03-31`;

      const existing = await db.query('SELECT * FROM financial_year WHERE code = $1', [code]);
      if (existing.rows.length > 0) {
        return error(res, `Financial Year ${code} already exists`, 409);
      }

      const { rows } = await db.query(
        `INSERT INTO financial_year (code, start_date, end_date, remarks, is_closed, is_system_generated)
         VALUES ($1, $2, $3, $4, false, false)
         RETURNING *`,
        [code, startDate, endDate, remarks || null]
      );
      success(res, rows[0], 201);
    } catch (err) { next(err); }
  }
);

// POST /api/v1/financial-years/:code/close
router.post('/:code/close', authorize('Admin'),
  [body('remarks').optional().isString()],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const code = req.params.code;

      const errors = [];

      const { rows: fy } = await db.query('SELECT * FROM financial_year WHERE code = $1', [code]);
      if (fy.length === 0) return error(res, 'Financial year not found', 404);
      if (fy[0].is_closed) return error(res, 'Already closed', 400);

      if (!fy[0].depreciation_run) errors.push('Depreciation not run for this FY');

      // Check all departments verified (verification is tenant-scoped)
      const { rows: unverified } = await db.query(
        `SELECT d.code FROM department d
         LEFT JOIN verification v ON v.department_id = d.id AND v.financial_year = $1 AND v.vidyalaya_id = $2
         WHERE v.id IS NULL OR v.status != 'COMPLETED'`, [code, vid]
      );
      if (unverified.length > 0) {
        errors.push(`Verification incomplete for: ${unverified.map(d => d.code).join(', ')}`);
      }

      // Check pending condemnations (tenant-scoped)
      const { rows: pending } = await db.query(
        `SELECT COUNT(*) AS cnt FROM condemnation_entry
         WHERE financial_year = $1 AND vidyalaya_id = $2 AND status IN ('PENDING','BOARD_REVIEWED')`, [code, vid]
      );
      if (parseInt(pending[0].cnt, 10) > 0) {
        errors.push(`${pending[0].cnt} pending condemnation(s) remain`);
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Pre-close validation failed',
          details: errors,
        });
      }

      // Close the FY (global table)
      const { rows: closed } = await db.query(
        `UPDATE financial_year SET is_closed = true, closed_by = $1, closed_at = NOW(), remarks = $2
         WHERE code = $3 RETURNING *`,
        [req.user.id, req.body.remarks, code]
      );

      // Create next FY if it doesn't exist
      const startYear = parseInt(code.split('-')[0], 10) + 1;
      const nextCode = `${startYear}-${String(startYear + 1).slice(2)}`;
      await db.query(
        `INSERT INTO financial_year (code, start_date, end_date)
         VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`,
        [nextCode, `${startYear}-04-01`, `${startYear + 1}-03-31`]
      );

      success(res, closed[0]);
    } catch (err) { next(err); }
  }
);

// POST /api/v1/financial-years/:code/reopen
router.post('/:code/reopen', authorize('Admin'),
  [body('reason').notEmpty(), body('authorization').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `UPDATE financial_year SET is_closed = false, closed_by = NULL, closed_at = NULL,
          remarks = remarks || ' | REOPENED: ' || $1
         WHERE code = $2 RETURNING *`,
        [req.body.reason, req.params.code]
      );
      if (rows.length === 0) return error(res, 'Financial year not found', 404);
      success(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/financial-years/:code (Delete empty FY with 0 records)
router.delete('/:code', authorize('Admin'), async (req, res, next) => {
  try {
    const { code } = req.params;

    const { rows: fy } = await db.query('SELECT * FROM financial_year WHERE code = $1', [code]);
    if (fy.length === 0) return error(res, 'Financial year not found', 404);

    const { total, breakdown } = await countFyRecords(code);
    if (total > 0) {
      return error(
        res,
        `Cannot delete Financial Year ${code}: it contains ${total} linked record(s). Only financial years with 0 records can be deleted.`,
        400,
        breakdown
      );
    }

    await db.query('DELETE FROM financial_year WHERE code = $1', [code]);
    success(res, { message: `Financial Year ${code} deleted successfully` });
  } catch (err) { next(err); }
});

module.exports = router;
