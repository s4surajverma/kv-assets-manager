const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const onboardingService = require('../services/OnboardingService');
const { success, created, error } = require('../utils/responseHelper');

/**
 * Onboarding Routes — Historical Asset Opening Entry
 *
 * POST /api/v1/onboarding/preview   — Dry-run preview (no writes)
 * POST /api/v1/onboarding/execute   — Atomic onboarding transaction
 */

// POST /api/v1/onboarding/preview
router.post('/preview',
  authorize('Admin', 'StockHolder'),
  [
    body('purchase_date').isDate(),
    body('total_cost').isFloat({ gt: 0 }),
    body('category_id').isInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await onboardingService.preview(req.body);
      success(res, result);
    } catch (err) { next(err); }
  }
);

// POST /api/v1/onboarding/execute
router.post('/execute',
  authorize('Admin'),
  [
    // Stock entry fields
    body('operational_department_id').isInt(),
    body('stock_volume_no').optional().isInt(),
    // Asset fields
    body('name').notEmpty(),
    body('category_id').isInt(),
    body('funding_head_id').isInt(),
    body('asset_head_id').isInt(),
    body('purchase_date').isDate(),
    body('total_units').isInt({ min: 1 }),
    body('unit_cost').isFloat({ min: 0 }),
    body('total_cost').isFloat({ gt: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await onboardingService.execute(req.body, req.user.id);
      created(res, result);
    } catch (err) { next(err); }
  }
);

// GET /api/v1/onboarding/opening-balances
router.get('/opening-balances',
  authorize('Admin', 'StockHolder'),
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const fy = req.query.fy || require('../utils/financialYear').current();
      const rows = await onboardingService.getOpeningSnapshots(vid, fy);
      success(res, rows);
    } catch (err) { next(err); }
  }
);

// POST /api/v1/onboarding/opening-balances
router.post('/opening-balances',
  authorize('Admin'),
  [
    body('financial_year').notEmpty(),
    body('snapshots').isArray(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const { financial_year, snapshots } = req.body;
      const results = await onboardingService.saveOpeningSnapshots(vid, financial_year, snapshots, req.user.id);
      success(res, results);
    } catch (err) { next(err); }
  }
);

// GET /api/v1/onboarding/status
router.get('/status',
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const fy = req.query.fy;
      const status = await onboardingService.getSetupStatus(vid, fy);
      success(res, status);
    } catch (err) { next(err); }
  }
);

// POST /api/v1/onboarding/bulk
router.post('/bulk',
  authorize('Admin'),
  [
    body('rows').isArray({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { rows } = req.body;
      const result = await onboardingService.executeBulk(rows, req.user.id);
      success(res, result);
    } catch (err) { next(err); }
  }
);

module.exports = router;

