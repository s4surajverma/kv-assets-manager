/**
 * Non-Consumable Issue / Return Routes
 * ─────────────────────────────────────
 * Custody management endpoints for non-consumable assets.
 * All write operations delegate to NonConsumableMovementService
 * which handles atomic transactions internally.
 */
const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const { success, created, error } = require('../utils/responseHelper');
const movementService = require('../services/NonConsumableMovementService');


// ─── POST /api/v1/non-consumables/issue ─────────────────────
// Create a new custody issue transaction.
router.post('/issue',
  authorize('Admin', 'StockHolder'),
  [
    body('issued_from_department_id').isInt().withMessage('Issuing department is required'),
    body('issue_target_type').isIn(['DEPARTMENT', 'USER']).withMessage('Target type must be DEPARTMENT or USER'),
    body('purpose').notEmpty().withMessage('Purpose is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.asset_id').isInt().withMessage('Each item must have an asset_id'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item must have quantity >= 1'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await movementService.issueAssets({
        vidyalayaId: req.user.vidyalaya_id,
        issuedByUserId: req.user.id,
        issuedFromDepartmentId: req.body.issued_from_department_id,
        issueTargetType: req.body.issue_target_type,
        issuedToDepartmentId: req.body.issued_to_department_id || null,
        issuedToUserId: req.body.issued_to_user_id || null,
        issueDate: req.body.issue_date || null,
        purpose: req.body.purpose,
        expectedReturnDate: req.body.expected_return_date || null,
        officeOrderNo: req.body.office_order_no || null,
        approvalReference: req.body.approval_reference || null,
        handReceiptNo: req.body.hand_receipt_no || null,
        remarks: req.body.remarks || null,
        items: req.body.items.map(i => ({
          assetId: i.asset_id,
          quantity: i.quantity,
          movementAssetType: i.movement_asset_type || null,
          conditionAtIssue: i.condition_at_issue || 'GOOD',
        })),
      });
      created(res, result);
    } catch (err) {
      if (err.message.includes('not found') || err.message.includes('cannot issue') || err.message.includes('available')) {
        return error(res, err.message, 400);
      }
      next(err);
    }
  }
);


// ─── POST /api/v1/non-consumables/return ────────────────────
// Process a return (partial or full) for an existing issue.
router.post('/return',
  authorize('Admin', 'StockHolder'),
  [
    body('issue_master_id').isInt().withMessage('Issue master ID is required'),
    body('returns').isArray({ min: 1 }).withMessage('At least one return item is required'),
    body('returns.*.issue_item_id').isInt().withMessage('Each return must reference an issue_item_id'),
    body('returns.*.quantity_returning').isInt({ min: 1 }).withMessage('Each return must have quantity >= 1'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await movementService.returnAssets({
        vidyalayaId: req.user.vidyalaya_id,
        issueMasterId: req.body.issue_master_id,
        returnedByUserId: req.user.id,
        returns: req.body.returns.map(r => ({
          issueItemId: r.issue_item_id,
          quantityReturning: r.quantity_returning,
          conditionAtReturn: r.condition_at_return || null,
          returnRemarks: r.return_remarks || '',
        })),
      });
      success(res, result);
    } catch (err) {
      if (err.message.includes('not found') || err.message.includes('outstanding') || err.message.includes('already')) {
        return error(res, err.message, 400);
      }
      next(err);
    }
  }
);


// ─── POST /api/v1/non-consumables/:id/cancel ────────────────
// Cancel an issue (only if nothing has been returned).
router.post('/:id/cancel',
  authorize('Admin', 'StockHolder'),
  async (req, res, next) => {
    try {
      const result = await movementService.cancelIssue(
        parseInt(req.params.id, 10),
        req.user.vidyalaya_id,
        req.user.id
      );
      success(res, result);
    } catch (err) {
      if (err.message.includes('not found') || err.message.includes('finalized') || err.message.includes('Cannot cancel')) {
        return error(res, err.message, 400);
      }
      next(err);
    }
  }
);


// ─── GET /api/v1/non-consumables/issues ─────────────────────
// List all issue transactions with optional filters.
router.get('/issues', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { status, dept_id, user_id, from_date, to_date } = req.query;

    let sql = `
      SELECT m.*,
             od_from.name AS from_department_name,
             od_to.name   AS to_department_name,
             u_to.name    AS to_user_name,
             u_by.name    AS issued_by_name,
             (SELECT SUM(quantity_issued) FROM non_consumable_issue_items WHERE issue_master_id = m.id) AS total_qty_issued,
             (SELECT SUM(quantity_returned) FROM non_consumable_issue_items WHERE issue_master_id = m.id) AS total_qty_returned
      FROM non_consumable_issue_master m
      LEFT JOIN operational_department od_from ON od_from.id = m.issued_from_department_id
      LEFT JOIN operational_department od_to   ON od_to.id = m.issued_to_department_id
      LEFT JOIN "user" u_to ON u_to.id = m.issued_to_user_id
      LEFT JOIN "user" u_by ON u_by.id = m.issued_by_user_id
    `;
    const params = [vid];
    const where = ['m.vidyalaya_id = $1'];

    if (status) { params.push(status); where.push(`m.status = $${params.length}`); }
    if (dept_id) { params.push(dept_id); where.push(`m.issued_from_department_id = $${params.length}`); }
    if (user_id) { params.push(user_id); where.push(`m.issued_to_user_id = $${params.length}`); }
    if (from_date) { params.push(from_date); where.push(`m.issue_date >= $${params.length}`); }
    if (to_date) { params.push(to_date); where.push(`m.issue_date <= $${params.length}`); }

    sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY m.movement_sequence_no DESC';

    const { rows } = await db.query(sql, params);
    success(res, rows);
  } catch (err) { next(err); }
});


// ─── GET /api/v1/non-consumables/issues/:id ─────────────────
// Get detailed issue record with all items.
router.get('/issues/:id', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const id = parseInt(req.params.id, 10);

    // Master
    const { rows: masterRows } = await db.query(
      `SELECT m.*,
              od_from.name AS from_department_name,
              od_to.name   AS to_department_name,
              u_to.name    AS to_user_name,
              u_by.name    AS issued_by_name
       FROM non_consumable_issue_master m
       LEFT JOIN operational_department od_from ON od_from.id = m.issued_from_department_id
       LEFT JOIN operational_department od_to   ON od_to.id = m.issued_to_department_id
       LEFT JOIN "user" u_to ON u_to.id = m.issued_to_user_id
       LEFT JOIN "user" u_by ON u_by.id = m.issued_by_user_id
       WHERE m.id = $1 AND m.vidyalaya_id = $2`,
      [id, vid]
    );
    if (masterRows.length === 0) return error(res, 'Issue record not found', 404);

    // Items
    const { rows: items } = await db.query(
      `SELECT i.*, a.total_units, a.total_issued_quantity
       FROM non_consumable_issue_items i
       JOIN asset a ON a.id = i.asset_id
       WHERE i.issue_master_id = $1`,
      [id]
    );

    success(res, { ...masterRows[0], items });
  } catch (err) { next(err); }
});


// ─── GET /api/v1/non-consumables/timeline/:assetId ──────────
// Read-only movement history for a specific asset.
router.get('/timeline/:assetId', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const assetId = parseInt(req.params.assetId, 10);

    const { rows } = await db.query(
      `SELECT i.id AS item_id,
              i.movement_asset_type,
              i.quantity_issued, i.quantity_returned,
              i.condition_at_issue, i.condition_at_return,
              i.asset_name_snapshot, i.asset_number_snapshot,
              i.issued_from_snapshot, i.target_name_snapshot,
              i.return_remarks,
              i.created_at AS item_created_at,
              m.issue_no, m.issue_date, m.purpose,
              m.issue_target_type, m.status,
              m.expected_return_date, m.returned_at, m.cancelled_at,
              m.office_order_no
       FROM non_consumable_issue_items i
       JOIN non_consumable_issue_master m ON m.id = i.issue_master_id
       WHERE i.asset_id = $1 AND m.vidyalaya_id = $2
       ORDER BY m.movement_sequence_no DESC`,
      [assetId, vid]
    );

    success(res, rows);
  } catch (err) { next(err); }
});


// ─── GET /api/v1/non-consumables/active-custody/:assetId ────
// Quick check: who currently holds this asset?
router.get('/active-custody/:assetId', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const assetId = parseInt(req.params.assetId, 10);

    const { rows } = await db.query(
      `SELECT i.quantity_issued - i.quantity_returned AS qty_out,
              i.asset_name_snapshot, i.condition_at_issue,
              m.issue_no, m.issue_date, m.purpose,
              m.issue_target_type, m.status,
              m.expected_return_date,
              i.target_name_snapshot AS currently_with
       FROM non_consumable_issue_items i
       JOIN non_consumable_issue_master m ON m.id = i.issue_master_id
       WHERE i.asset_id = $1 AND m.vidyalaya_id = $2
         AND m.status IN ('ISSUED', 'PARTIALLY_RETURNED')
         AND (i.quantity_issued - i.quantity_returned) > 0
       ORDER BY m.movement_sequence_no DESC`,
      [assetId, vid]
    );

    success(res, rows);
  } catch (err) { next(err); }
});


// ─── GET /api/v1/non-consumables/available-assets ───────────
// List assets available for issuance from a department.
router.get('/available-assets', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { dept_id } = req.query;
    if (!dept_id) return error(res, 'dept_id is required', 400);

    const { rows } = await db.query(
      `SELECT a.id, a.asset_number, a.name, a.total_units,
              a.total_issued_quantity,
              (a.total_units - a.total_issued_quantity) AS available_quantity,
              a.status, ac.name AS category_name,
              a.asset_classification
       FROM asset a
       JOIN asset_category ac ON ac.id = a.category_id
       WHERE a.operational_department_id = $1
         AND a.vidyalaya_id = $2
         AND a.status = 'ACTIVE'
         AND (a.total_units - a.total_issued_quantity) > 0
       ORDER BY a.name ASC`,
      [dept_id, vid]
    );

    success(res, rows);
  } catch (err) { next(err); }
});


// ─── GET /api/v1/non-consumables/active-issues ──────────────
// All currently active (unreturned) issues. Used by ReturnForm.
router.get('/active-issues', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;

    const { rows } = await db.query(
      `SELECT m.id, m.issue_no, m.issue_date, m.purpose,
              m.issue_target_type, m.status,
              m.expected_return_date,
              od_from.name AS from_department_name,
              COALESCE(od_to.name, u_to.name) AS target_name,
              (SELECT SUM(quantity_issued - quantity_returned)
               FROM non_consumable_issue_items WHERE issue_master_id = m.id) AS total_outstanding
       FROM non_consumable_issue_master m
       LEFT JOIN operational_department od_from ON od_from.id = m.issued_from_department_id
       LEFT JOIN operational_department od_to   ON od_to.id = m.issued_to_department_id
       LEFT JOIN "user" u_to ON u_to.id = m.issued_to_user_id
       WHERE m.vidyalaya_id = $1
         AND m.status IN ('ISSUED', 'PARTIALLY_RETURNED')
       ORDER BY m.issue_date DESC`,
      [vid]
    );

    success(res, rows);
  } catch (err) { next(err); }
});


module.exports = router;
