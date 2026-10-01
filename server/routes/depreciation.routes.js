const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const depreciationService = require('../services/DepreciationService');
const condemnationCalcService = require('../services/CondemnationCalcService');
const calcEngine = require('../services/DepreciationCalcEngine');
const { success, error } = require('../utils/responseHelper');


// POST /api/v1/depreciation/run
router.post('/run', authorize('Admin'),
  [body('financial_year').notEmpty()], validate,
  async (req, res, next) => {
    try {
      const result = await depreciationService.runAnnualDepreciation(req.body.financial_year, req.user.id);
      success(res, result);
    } catch (err) { next(err); }
  }
);

// POST /api/v1/depreciation/run-preview
router.post('/run-preview', authorize('Admin'),
  [body('financial_year').notEmpty()], validate,
  async (req, res, next) => {
    try {
      const preview = await depreciationService.previewDepreciation(req.body.financial_year);
      success(res, preview);
    } catch (err) { next(err); }
  }
);

// GET /api/v1/depreciation/ledger
router.get('/ledger', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { asset_id, fy, asset_head_id, fund_id } = req.query;
    let sql = `SELECT dl.*, a.asset_number, a.name AS asset_name
               FROM depreciation_ledger dl
               JOIN asset a ON a.id = dl.asset_id`;
    const params = [vid];
    const where = ['dl.vidyalaya_id = $1'];

    if (asset_id) { params.push(asset_id); where.push(`dl.asset_id = $${params.length}`); }
    if (fy) { params.push(fy); where.push(`dl.financial_year = $${params.length}`); }
    if (asset_head_id) { params.push(asset_head_id); where.push(`a.department_id = $${params.length}`); }
    if (fund_id) { params.push(fund_id); where.push(`a.funding_head_id = $${params.length}`); }
    sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY dl.financial_year, a.asset_number';

    const { rows } = await db.query(sql, params);
    success(res, rows);
  } catch (err) { next(err); }
});

// GET /api/v1/depreciation/summary
router.get('/summary', authorize('Admin'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { fy, fund_id } = req.query;
    if (!fy) return error(res, 'Financial year required', 400);

    let sql = `SELECT d.code AS department, d.name AS department_name,
                      SUM(dl.opening_value) AS opening_depr,
                      SUM(dl.depreciation_amount) AS year_depr,
                      SUM(dl.closing_value) AS closing_value,
                      SUM(dl.accum_depreciation) AS closing_depr,
                      COUNT(*) AS asset_count
               FROM depreciation_ledger dl
               JOIN asset a ON a.id = dl.asset_id
               JOIN department d ON d.id = a.department_id
               WHERE dl.financial_year = $1 AND dl.vidyalaya_id = $2`;
    const params = [fy, vid];
    if (fund_id) { params.push(fund_id); sql += ` AND a.funding_head_id = $${params.length}`; }
    sql += ' GROUP BY d.code, d.name ORDER BY d.code';

    const { rows } = await db.query(sql, params);
    success(res, rows);
  } catch (err) { next(err); }
});

// POST /api/v1/depreciation/calculate-condemnation
router.post('/calculate-condemnation',
  authorize('StockHolder'),
  [body('asset_id').isInt()], validate,
  async (req, res, next) => {
    try {
      const method = req.body.depreciation_method || 'BOTH';
      const result = await condemnationCalcService.compute(req.body.asset_id, method);
      const warningCheck = await condemnationCalcService.pendingDepreciationCheck(req.body.asset_id, req.user.vidyalaya_id);
      if (warningCheck.hasPending) {
        result.warning = warningCheck.message;
      }
      success(res, result);
    } catch (err) { next(err); }
  }
);

// GET /api/v1/depreciation/asset/:assetId/history
// Full depreciation history for detail modal (used by Depreciation + Condemnation UI)
router.get('/asset/:assetId/history', async (req, res, next) => {
  try {
    const result = await calcEngine.getFullHistory(parseInt(req.params.assetId));
    success(res, result);
  } catch (err) { next(err); }
});

module.exports = router;

