const router = require('express').Router();
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const { success, error } = require('../utils/responseHelper');
const transitionNumber = require('../services/TransitionNumberService');

// ============================================================
// POST /api/v1/transitions — Create new transition (DRAFT)
// Generates stock snapshot using SELECT ... FOR UPDATE
// ============================================================
router.post('/', authorize('Admin'),
  [
    body('operational_department_id').isInt().withMessage('Operational department is required'),
    body('taken_over_by_user_id').isInt().withMessage('Incoming stock holder is required'),
    body('handover_reason').optional().isIn(['TRANSFER', 'RETIREMENT', 'ADDITIONAL_CHARGE', 'INTERNAL_REALLOCATION', 'LONG_LEAVE']),
    body('effective_from_date').optional().isDate(),
    body('administrative_remarks').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    const client = await db.getTenantClient();
    try {
      const vid = req.user.vidyalaya_id;
      const { operational_department_id, taken_over_by_user_id, handover_reason, effective_from_date, administrative_remarks } = req.body;

      await client.query('BEGIN');

      // 1. Lock and fetch operational department
      const { rows: deptRows } = await client.query(
        `SELECT od.id, od.incharge_id, od.name, u.name AS incharge_name
         FROM operational_department od
         LEFT JOIN "user" u ON u.id = od.incharge_id
         WHERE od.id = $1 AND od.vidyalaya_id = $2
         FOR UPDATE OF od`,
        [operational_department_id, vid]
      );
      if (deptRows.length === 0) {
        await client.query('ROLLBACK');
        return error(res, 'Operational department not found', 404);
      }

      const dept = deptRows[0];
      if (!dept.incharge_id) {
        await client.query('ROLLBACK');
        return error(res, 'This operational department has no current incharge assigned', 400);
      }

      const handed_over_by_user_id = dept.incharge_id;

      // 2. Self-transfer check
      if (handed_over_by_user_id === taken_over_by_user_id) {
        await client.query('ROLLBACK');
        return error(res, 'Handing over and taking over cannot be the same person', 400);
      }

      // 3. Fetch incoming user name
      const { rows: incomingRows } = await client.query(
        `SELECT id, name FROM "user" WHERE id = $1 AND vidyalaya_id = $2 AND is_active = true`,
        [taken_over_by_user_id, vid]
      );
      if (incomingRows.length === 0) {
        await client.query('ROLLBACK');
        return error(res, 'Incoming stock holder not found or inactive', 404);
      }

      // 4. Insert master record
      const { rows: masterRows } = await client.query(
        `INSERT INTO stock_transition_master (
           vidyalaya_id, operational_department_id,
           handed_over_by_user_id, taken_over_by_user_id, initiated_by,
           handed_over_by_name, taken_over_by_name,
           transition_date, effective_from_date, handover_reason,
           administrative_remarks, status, snapshot_generated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE,$8,$9,$10,'DRAFT',NOW())
         RETURNING *`,
        [
          vid, operational_department_id,
          handed_over_by_user_id, taken_over_by_user_id, req.user.id,
          dept.incharge_name, incomingRows[0].name,
          effective_from_date || null, handover_reason || null,
          administrative_remarks || null,
        ]
      );
      const master = masterRows[0];

      // 5. Generate stock snapshot — lock assets during snapshot
      const { rows: assets } = await client.query(
        `SELECT a.id, a.asset_number, a.name, a.department_id, a.funding_head_id,
                ac.code AS classification_code, a.status AS asset_status,
                a.total_units,
                sl.stock_volume_no, sl.stock_page_no
         FROM asset a
         LEFT JOIN asset_category ac ON ac.id = a.category_id
         LEFT JOIN stock_ledger sl ON sl.id = a.stock_ledger_id
         WHERE a.operational_department_id = $1
           AND a.status IN ('ACTIVE', 'UNDER_CONDEMNATION')
           AND a.vidyalaya_id = $2
         ORDER BY a.asset_number
         FOR UPDATE OF a`,
        [operational_department_id, vid]
      );

      // 6. Insert snapshot items
      for (const asset of assets) {
        await client.query(
          `INSERT INTO stock_transition_items (
             transition_master_id, asset_id,
             asset_number, asset_name, asset_head_id, funding_head_id,
             asset_classification, asset_status_snapshot,
             stock_volume_no, stock_page_no,
             quantity_system
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            master.id, asset.id,
            asset.asset_number, asset.name, asset.department_id, asset.funding_head_id,
            asset.classification_code, asset.asset_status,
            asset.stock_volume_no, asset.stock_page_no,
            asset.total_units,
          ]
        );
      }

      // 7. Update total_items on master
      await client.query(
        `UPDATE stock_transition_master SET total_items = $1 WHERE id = $2 AND vidyalaya_id = $3`,
        [assets.length, master.id, vid]
      );

      // 8. Audit log
      await client.query(
        `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, vidyalaya_id)
         VALUES ('stock_transition_master', $1, 'INSERT', $2::jsonb, $3, $4)`,
        [master.id, JSON.stringify({ status: 'DRAFT', operational_department_id, items: assets.length }), req.user.id, vid]
      );

      await client.query('COMMIT');

      // Re-fetch with items for response
      const { rows: items } = await db.rawQuery(
        `SELECT * FROM stock_transition_items WHERE transition_master_id = $1 ORDER BY asset_number`,
        [master.id]
      );

      master.total_items = assets.length;
      success(res, { transition: master, items }, 201);
    } catch (e) {
      await client.query('ROLLBACK');
      // Handle unique constraint on active transitions
      if (e.code === '23505' && e.constraint === 'idx_unique_active_transition') {
        return error(res, 'An active stock charge transfer already exists for this operational department. Complete or cancel it first.', 409);
      }
      next(e);
    } finally {
      client.release();
    }
  }
);

// ============================================================
// GET /api/v1/transitions — List transitions
// ============================================================
router.get('/', authorize('Admin'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { status: statusFilter, operational_department_id } = req.query;

    let sql = `SELECT stm.*,
                      od.name AS operational_department_name,
                      od.code AS operational_department_code
               FROM stock_transition_master stm
               JOIN operational_department od ON od.id = stm.operational_department_id`;
    const params = [vid];
    const where = ['stm.vidyalaya_id = $1'];

    if (statusFilter) {
      params.push(statusFilter);
      where.push(`stm.status = $${params.length}`);
    }
    if (operational_department_id) {
      params.push(operational_department_id);
      where.push(`stm.operational_department_id = $${params.length}`);
    }

    sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY stm.created_at DESC';

    const { rows } = await db.query(sql, params);
    success(res, rows);
  } catch (err) { next(err); }
});

// ============================================================
// GET /api/v1/transitions/:id — Fetch transition details + items
// ============================================================
router.get('/:id', authorize('Admin'),
  [param('id').isInt()], validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const { rows: masterRows } = await db.query(
        `SELECT stm.*,
                od.name AS operational_department_name,
                od.code AS operational_department_code
         FROM stock_transition_master stm
         JOIN operational_department od ON od.id = stm.operational_department_id
         WHERE stm.id = $1 AND stm.vidyalaya_id = $2`,
        [req.params.id, vid]
      );
      if (masterRows.length === 0) return error(res, 'Transition not found', 404);

      const { rows: items } = await db.rawQuery(
        `SELECT sti.*,
                d.name AS asset_head_name,
                fh.name AS funding_head_name
         FROM stock_transition_items sti
         LEFT JOIN department d ON d.id = sti.asset_head_id
         LEFT JOIN funding_head fh ON fh.id = sti.funding_head_id
         WHERE sti.transition_master_id = $1
         ORDER BY sti.asset_number`,
        [req.params.id]
      );

      success(res, { transition: masterRows[0], items });
    } catch (err) { next(err); }
  }
);

// ============================================================
// PUT /api/v1/transitions/:id — Update master details (DRAFT/UNDER_VERIFICATION only)
// ============================================================
router.put('/:id', authorize('Admin'),
  [param('id').isInt()], validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const { administrative_remarks, effective_from_date, handover_reason, version_no } = req.body;

      // Optimistic concurrency check
      const { rows: current } = await db.query(
        `SELECT id, status, version_no FROM stock_transition_master WHERE id = $1 AND vidyalaya_id = $2`,
        [req.params.id, vid]
      );
      if (current.length === 0) return error(res, 'Transition not found', 404);
      if (current[0].status === 'COMPLETED' || current[0].status === 'CANCELLED') {
        return error(res, 'Finalized transitions cannot be updated', 403);
      }
      if (version_no !== undefined && current[0].version_no !== version_no) {
        return error(res, 'This record has been modified by another user. Please refresh and try again.', 409);
      }

      const sets = [];
      const params = [req.params.id, vid];

      if (administrative_remarks !== undefined) {
        params.push(administrative_remarks);
        sets.push(`administrative_remarks = $${params.length}`);
      }
      if (effective_from_date !== undefined) {
        params.push(effective_from_date);
        sets.push(`effective_from_date = $${params.length}`);
      }
      if (handover_reason !== undefined) {
        params.push(handover_reason);
        sets.push(`handover_reason = $${params.length}`);
      }

      if (sets.length === 0) return error(res, 'No fields to update', 400);

      const { rows } = await db.query(
        `UPDATE stock_transition_master SET ${sets.join(', ')} WHERE id = $1 AND vidyalaya_id = $2 RETURNING *`,
        params
      );
      success(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// ============================================================
// PUT /api/v1/transitions/:id/verify — Incremental item verification save
// ============================================================
router.put('/:id/verify', authorize('Admin'),
  [
    param('id').isInt(),
    body('items').isArray({ min: 1 }).withMessage('Items array is required'),
  ],
  validate,
  async (req, res, next) => {
    const client = await db.getTenantClient();
    try {
      const vid = req.user.vidyalaya_id;

      // Verify ownership and status
      const { rows: masterRows } = await client.query(
        `SELECT id, status FROM stock_transition_master WHERE id = $1 AND vidyalaya_id = $2`,
        [req.params.id, vid]
      );
      if (masterRows.length === 0) {
        return error(res, 'Transition not found', 404);
      }
      if (masterRows[0].status !== 'UNDER_VERIFICATION') {
        return error(res, 'Items can only be verified when status is UNDER_VERIFICATION', 400);
      }

      await client.query('BEGIN');

      // Update each item
      for (const item of req.body.items) {
        // Validate mandatory remarks for DAMAGED/MISSING
        if ((item.condition_status === 'DAMAGED' || item.condition_status === 'MISSING') && !item.remarks) {
          await client.query('ROLLBACK');
          return error(res, `Remarks are mandatory for items marked as ${item.condition_status} (Item ID: ${item.id})`, 422);
        }

        await db.rawQuery(
          `UPDATE stock_transition_items
           SET quantity_verified = $1,
               condition_status = $2,
               discrepancy_type = $3,
               remarks = $4,
               verified_at = NOW()
           WHERE id = $5 AND transition_master_id = $6`,
          [
            item.quantity_verified,
            item.condition_status,
            item.discrepancy_type || null,
            item.remarks || null,
            item.id,
            req.params.id,
          ]
        );
      }

      // Dynamically update verified_items count on master
      const { rows: countRows } = await db.rawQuery(
        `SELECT
           COUNT(*) FILTER (WHERE quantity_verified IS NOT NULL AND condition_status IS NOT NULL) AS verified_count,
           COUNT(*) FILTER (WHERE condition_status IN ('DAMAGED', 'MISSING') OR quantity_verified != quantity_system) AS discrepancy_count
         FROM stock_transition_items WHERE transition_master_id = $1`,
        [req.params.id]
      );

      await client.query(
        `UPDATE stock_transition_master SET verified_items = $1, discrepancy_count = $2 WHERE id = $3 AND vidyalaya_id = $4`,
        [parseInt(countRows[0].verified_count), parseInt(countRows[0].discrepancy_count), req.params.id, vid]
      );

      await client.query('COMMIT');

      // Re-fetch items for response
      const { rows: items } = await db.rawQuery(
        `SELECT sti.*,
                d.name AS asset_head_name,
                fh.name AS funding_head_name
         FROM stock_transition_items sti
         LEFT JOIN department d ON d.id = sti.asset_head_id
         LEFT JOIN funding_head fh ON fh.id = sti.funding_head_id
         WHERE sti.transition_master_id = $1
         ORDER BY sti.asset_number`,
        [req.params.id]
      );

      success(res, items);
    } catch (e) {
      await client.query('ROLLBACK');
      next(e);
    } finally {
      client.release();
    }
  }
);

// ============================================================
// POST /api/v1/transitions/:id/submit-verification
// Moves DRAFT → UNDER_VERIFICATION
// ============================================================
router.post('/:id/submit-verification', authorize('Admin'),
  [param('id').isInt()], validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;

      const { rows: current } = await db.query(
        `SELECT id, status FROM stock_transition_master WHERE id = $1 AND vidyalaya_id = $2`,
        [req.params.id, vid]
      );
      if (current.length === 0) return error(res, 'Transition not found', 404);
      if (current[0].status !== 'DRAFT') {
        return error(res, 'Only DRAFT transitions can be submitted for verification', 400);
      }

      const { rows } = await db.query(
        `UPDATE stock_transition_master SET status = 'UNDER_VERIFICATION', verification_date = CURRENT_DATE
         WHERE id = $1 AND vidyalaya_id = $2 RETURNING *`,
        [req.params.id, vid]
      );

      // Audit log
      await db.query(
        `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, vidyalaya_id)
         VALUES ('stock_transition_master', $1, 'UPDATE', $2::jsonb, $3, $4)`,
        [req.params.id, JSON.stringify({ status: 'UNDER_VERIFICATION' }), req.user.id, vid]
      );

      success(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// ============================================================
// POST /api/v1/transitions/:id/finalize — Complete the transfer
// Single DB transaction; validates all items verified, validates
// incharge hasn't changed, generates official order number
// ============================================================
router.post('/:id/finalize', authorize('Admin'),
  [
    param('id').isInt(),
    body('verified_by_user_id').optional().isInt(),
    body('principal_id').optional().isInt(),
  ],
  validate,
  async (req, res, next) => {
    const client = await db.getTenantClient();
    try {
      const vid = req.user.vidyalaya_id;
      const { verified_by_user_id, principal_id } = req.body;

      await client.query('BEGIN');

      // 1. Lock master record
      const { rows: masterRows } = await client.query(
        `SELECT * FROM stock_transition_master WHERE id = $1 AND vidyalaya_id = $2 FOR UPDATE`,
        [req.params.id, vid]
      );
      if (masterRows.length === 0) {
        await client.query('ROLLBACK');
        return error(res, 'Transition not found', 404);
      }
      const master = masterRows[0];

      if (master.status !== 'UNDER_VERIFICATION') {
        await client.query('ROLLBACK');
        return error(res, 'Only transitions under verification can be finalized', 400);
      }

      // 2. Pre-validation: All items must have quantity_verified and condition_status
      const { rows: unverified } = await db.rawQuery(
        `SELECT COUNT(*) AS cnt FROM stock_transition_items
         WHERE transition_master_id = $1
           AND (quantity_verified IS NULL OR condition_status IS NULL)`,
        [req.params.id]
      );
      if (parseInt(unverified[0].cnt) > 0) {
        await client.query('ROLLBACK');
        return error(res, `${unverified[0].cnt} item(s) have not been verified yet. All items must be verified before finalization.`, 422);
      }

      // 3. Validate incharge hasn't changed outside workflow
      const { rows: deptRows } = await client.query(
        `SELECT incharge_id FROM operational_department WHERE id = $1 AND vidyalaya_id = $2 FOR UPDATE`,
        [master.operational_department_id, vid]
      );
      if (deptRows[0].incharge_id !== master.handed_over_by_user_id) {
        await client.query('ROLLBACK');
        return error(res, 'The department incharge has been changed outside this workflow. This transition is now invalid.', 409);
      }

      // 4. Generate official order number
      const orderNumber = await transitionNumber.generate(client, vid);

      // 5. Compute final frozen summary
      const { rows: summaryRows } = await db.rawQuery(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE quantity_verified IS NOT NULL AND condition_status IS NOT NULL) AS verified,
           COUNT(*) FILTER (WHERE condition_status IN ('DAMAGED', 'MISSING') OR quantity_verified != quantity_system) AS discrepancies
         FROM stock_transition_items WHERE transition_master_id = $1`,
        [req.params.id]
      );
      const summary = summaryRows[0];

      // 6. Resolve verifier and principal names
      let verifiedByName = null;
      if (verified_by_user_id) {
        const { rows: vRows } = await client.query(
          `SELECT name FROM "user" WHERE id = $1 AND vidyalaya_id = $2`,
          [verified_by_user_id, vid]
        );
        if (vRows.length > 0) verifiedByName = vRows[0].name;
      }

      let principalName = null;
      if (principal_id) {
        const { rows: pRows } = await client.query(
          `SELECT name FROM "user" WHERE id = $1 AND vidyalaya_id = $2`,
          [principal_id, vid]
        );
        if (pRows.length > 0) principalName = pRows[0].name;
      }

      // 7. Finalize the master record
      await client.query(
        `UPDATE stock_transition_master SET
           status = 'COMPLETED',
           completed_at = NOW(),
           official_order_number = $1,
           report_generated_at = NOW(),
           total_items = $2,
           verified_items = $3,
           discrepancy_count = $4,
           verified_by = $5,
           verified_by_name = $6,
           principal_id = $7,
           principal_name = $8
         WHERE id = $9 AND vidyalaya_id = $10`,
        [
          orderNumber,
          parseInt(summary.total), parseInt(summary.verified), parseInt(summary.discrepancies),
          verified_by_user_id || null, verifiedByName,
          principal_id || null, principalName,
          req.params.id, vid,
        ]
      );

      // 8. Update department incharge mapping
      await client.query(
        `UPDATE operational_department SET incharge_id = $1 WHERE id = $2 AND vidyalaya_id = $3`,
        [master.taken_over_by_user_id, master.operational_department_id, vid]
      );

      // 9. Audit log: DEPARTMENT_INCHARGE_TRANSFERRED
      await client.query(
        `INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_by, vidyalaya_id)
         VALUES ('stock_transition_master', $1, 'UPDATE', $2::jsonb, $3::jsonb, $4, $5)`,
        [
          req.params.id,
          JSON.stringify({ status: 'UNDER_VERIFICATION', incharge_id: master.handed_over_by_user_id }),
          JSON.stringify({
            status: 'COMPLETED',
            event: 'DEPARTMENT_INCHARGE_TRANSFERRED',
            official_order_number: orderNumber,
            from_user: master.handed_over_by_name,
            to_user: master.taken_over_by_name,
            new_incharge_id: master.taken_over_by_user_id,
            total_items: parseInt(summary.total),
            discrepancies: parseInt(summary.discrepancies),
          }),
          req.user.id, vid,
        ]
      );

      await client.query('COMMIT');

      // Re-fetch for response
      const { rows: result } = await db.query(
        `SELECT * FROM stock_transition_master WHERE id = $1 AND vidyalaya_id = $2`,
        [req.params.id, vid]
      );
      success(res, result[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      next(e);
    } finally {
      client.release();
    }
  }
);

// ============================================================
// POST /api/v1/transitions/:id/cancel — Cancel a transition
// ============================================================
router.post('/:id/cancel', authorize('Admin'),
  [
    param('id').isInt(),
    body('cancellation_reason').notEmpty().withMessage('Cancellation reason is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const { cancellation_reason } = req.body;

      const { rows: current } = await db.query(
        `SELECT id, status FROM stock_transition_master WHERE id = $1 AND vidyalaya_id = $2`,
        [req.params.id, vid]
      );
      if (current.length === 0) return error(res, 'Transition not found', 404);
      if (current[0].status === 'COMPLETED' || current[0].status === 'CANCELLED') {
        return error(res, 'Finalized transitions cannot be cancelled', 403);
      }

      const { rows } = await db.query(
        `UPDATE stock_transition_master SET
           status = 'CANCELLED',
           cancelled_by = $1,
           cancelled_at = NOW(),
           cancellation_reason = $2
         WHERE id = $3 AND vidyalaya_id = $4
         RETURNING *`,
        [req.user.id, cancellation_reason, req.params.id, vid]
      );

      // Audit log: STOCK_CHARGE_TRANSFER_CANCELLED
      await db.query(
        `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, vidyalaya_id)
         VALUES ('stock_transition_master', $1, 'UPDATE', $2::jsonb, $3, $4)`,
        [
          req.params.id,
          JSON.stringify({
            status: 'CANCELLED',
            event: 'STOCK_CHARGE_TRANSFER_CANCELLED',
            reason: cancellation_reason,
          }),
          req.user.id, vid,
        ]
      );

      success(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// ============================================================
// GET /api/v1/transitions/:id/report/office-order
// Dynamically generates office order data (no stored PDF)
// ============================================================
router.get('/:id/report/office-order', authorize('Admin'),
  [param('id').isInt()], validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;

      const { rows: masterRows } = await db.query(
        `SELECT stm.*,
                od.name AS operational_department_name,
                od.code AS operational_department_code,
                v.kv_name_en, v.kv_name_hi, v.kv_code, v.regional_office_en, v.regional_office_hi
         FROM stock_transition_master stm
         JOIN operational_department od ON od.id = stm.operational_department_id
         JOIN vidyalaya v ON v.id = stm.vidyalaya_id
         WHERE stm.id = $1 AND stm.vidyalaya_id = $2`,
        [req.params.id, vid]
      );

      if (masterRows.length === 0) return error(res, 'Transition not found', 404);
      if (masterRows[0].status !== 'COMPLETED') {
        return error(res, 'Office order can only be generated for completed transitions', 400);
      }

      success(res, { officeOrder: masterRows[0] });
    } catch (err) { next(err); }
  }
);

// ============================================================
// GET /api/v1/transitions/:id/report/verification
// Dynamically generates verification report data
// ============================================================
router.get('/:id/report/verification', authorize('Admin'),
  [param('id').isInt()], validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;

      const { rows: masterRows } = await db.query(
        `SELECT stm.*,
                od.name AS operational_department_name,
                od.code AS operational_department_code,
                v.kv_name_en, v.kv_name_hi, v.kv_code, v.regional_office_en, v.regional_office_hi
         FROM stock_transition_master stm
         JOIN operational_department od ON od.id = stm.operational_department_id
         JOIN vidyalaya v ON v.id = stm.vidyalaya_id
         WHERE stm.id = $1 AND stm.vidyalaya_id = $2`,
        [req.params.id, vid]
      );

      if (masterRows.length === 0) return error(res, 'Transition not found', 404);

      const { rows: items } = await db.rawQuery(
        `SELECT sti.*,
                d.name AS asset_head_name,
                fh.name AS funding_head_name
         FROM stock_transition_items sti
         LEFT JOIN department d ON d.id = sti.asset_head_id
         LEFT JOIN funding_head fh ON fh.id = sti.funding_head_id
         WHERE sti.transition_master_id = $1
         ORDER BY sti.asset_number`,
        [req.params.id]
      );

      success(res, { report: masterRows[0], items });
    } catch (err) { next(err); }
  }
);

module.exports = router;
