/**
 * Non-Consumable Movement Service
 * ────────────────────────────────
 * Centralized service handling all custody movement operations.
 * Every public method runs inside a single DB transaction and
 * guarantees atomic state updates across:
 *   - non_consumable_issue_master / items
 *   - asset.total_issued_quantity / last_movement_at
 *   - asset.remarks (via RemarksHelper)
 *   - audit_log
 */
const db = require('../config/db');
const { appendMovementRemark } = require('./RemarksHelper');

class NonConsumableMovementService {

  // ─── ISSUE NUMBER GENERATOR (tenant-scoped) ──────────────
  /**
   * Generate the next issue number for a vidyalaya.
   * Format: NC/{VIDYALAYA_ID}/{YEAR}/{SEQ}
   * Must be called within a transaction for safety.
   */
  async _generateIssueNo(client, vid) {
    const year = new Date().getFullYear();
    const { rows } = await client.query(
      `SELECT COUNT(*) AS cnt FROM non_consumable_issue_master
       WHERE vidyalaya_id = $1
         AND EXTRACT(YEAR FROM created_at) = $2`,
      [vid, year]
    );
    const seq = parseInt(rows[0].cnt, 10) + 1;
    return `NC/${vid}/${year}/${String(seq).padStart(4, '0')}`;
  }

  /**
   * Generate the next movement sequence number for a vidyalaya.
   * Deterministic, chronological, tenant-scoped.
   */
  async _nextSequence(client, vid) {
    const { rows } = await client.query(
      `SELECT COALESCE(MAX(movement_sequence_no), 0) + 1 AS next_seq
       FROM non_consumable_issue_master WHERE vidyalaya_id = $1`,
      [vid]
    );
    return parseInt(rows[0].next_seq, 10);
  }

  // ─── ISSUE ASSETS ────────────────────────────────────────
  /**
   * Create a new non-consumable issue transaction.
   *
   * @param {object} params
   * @param {number} params.vidyalayaId
   * @param {number} params.issuedByUserId
   * @param {number} params.issuedFromDepartmentId
   * @param {string} params.issueTargetType  - 'DEPARTMENT' | 'USER'
   * @param {number} [params.issuedToDepartmentId]
   * @param {number} [params.issuedToUserId]
   * @param {string} params.purpose
   * @param {string} [params.expectedReturnDate]
   * @param {string} [params.officeOrderNo]
   * @param {string} [params.approvalReference]
   * @param {string} [params.handReceiptNo]
   * @param {string} [params.remarks]
   * @param {Array}  params.items - [{ assetId, quantity, movementAssetType, conditionAtIssue }]
   * @returns {object} The created master record with items
   */
  async issueAssets(params) {
    const client = await db.getTenantClient();
    try {
      await client.query('BEGIN');
      const vid = params.vidyalayaId;

      // 1. Validate all assets and check availability
      for (const item of params.items) {
        const { rows: assetRows } = await client.query(
          `SELECT id, name, asset_number, total_units, total_issued_quantity, status,
                  operational_department_id
           FROM asset WHERE id = $1 AND vidyalaya_id = $2 FOR UPDATE`,
          [item.assetId, vid]
        );
        if (assetRows.length === 0) throw new Error(`Asset ${item.assetId} not found`);
        const asset = assetRows[0];

        if (asset.status !== 'ACTIVE') {
          throw new Error(`Asset "${asset.name}" is ${asset.status} — cannot issue`);
        }

        const available = asset.total_units - asset.total_issued_quantity;
        if (item.quantity > available) {
          throw new Error(
            `Asset "${asset.name}": requested ${item.quantity}, available ${available}`
          );
        }

        // Store asset data on item for snapshot creation
        item._asset = asset;
      }

      // 2. Resolve target name for snapshots and remarks
      let targetName = '';
      if (params.issueTargetType === 'DEPARTMENT') {
        const { rows } = await client.query(
          `SELECT name FROM operational_department WHERE id = $1 AND vidyalaya_id = $2`,
          [params.issuedToDepartmentId, vid]
        );
        if (rows.length === 0) throw new Error('Target department not found');
        targetName = rows[0].name;
      } else {
        const { rows } = await client.query(
          `SELECT name FROM "user" WHERE id = $1 AND vidyalaya_id = $2`,
          [params.issuedToUserId, vid]
        );
        if (rows.length === 0) throw new Error('Target user not found');
        targetName = rows[0].name;
      }

      // 3. Resolve issuing department name for snapshot
      const { rows: fromDeptRows } = await client.query(
        `SELECT name FROM operational_department WHERE id = $1 AND vidyalaya_id = $2`,
        [params.issuedFromDepartmentId, vid]
      );
      const fromDeptName = fromDeptRows.length > 0 ? fromDeptRows[0].name : 'Unknown';

      // 4. Generate issue number and sequence
      const issueNo = await this._generateIssueNo(client, vid);
      const seqNo = await this._nextSequence(client, vid);

      // 5. Insert master record
      const { rows: masterRows } = await client.query(
        `INSERT INTO non_consumable_issue_master
         (vidyalaya_id, issue_no, movement_sequence_no,
          issued_by_user_id, issued_from_department_id,
          issue_target_type, issued_to_department_id, issued_to_user_id,
          issue_date, purpose, expected_return_date,
          office_order_no, approval_reference, hand_receipt_no,
          remarks, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                 COALESCE($9, CURRENT_DATE), $10, $11,
                 $12, $13, $14, $15, 'ISSUED')
         RETURNING *`,
        [
          vid, issueNo, seqNo,
          params.issuedByUserId, params.issuedFromDepartmentId,
          params.issueTargetType,
          params.issuedToDepartmentId || null,
          params.issuedToUserId || null,
          params.issueDate || null, params.purpose, params.expectedReturnDate || null,
          params.officeOrderNo || null, params.approvalReference || null,
          params.handReceiptNo || null, params.remarks || null,
        ]
      );
      const master = masterRows[0];

      // 6. Insert items + update asset state + append remarks
      const insertedItems = [];
      for (const item of params.items) {
        const asset = item._asset;

        const { rows: itemRows } = await client.query(
          `INSERT INTO non_consumable_issue_items
           (issue_master_id, asset_id, movement_asset_type,
            quantity_issued, condition_at_issue,
            asset_name_snapshot, asset_number_snapshot,
            issued_from_snapshot, target_name_snapshot)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            master.id, item.assetId,
            item.movementAssetType || (item.quantity === 1 ? 'SERIALIZED' : 'BULK'),
            item.quantity,
            item.conditionAtIssue || 'GOOD',
            asset.name, asset.asset_number || null,
            fromDeptName, targetName,
          ]
        );
        insertedItems.push(itemRows[0]);

        // Update asset derived state
        await client.query(
          `UPDATE asset
           SET total_issued_quantity = total_issued_quantity + $1,
               last_movement_at = NOW(),
               updated_at = NOW()
           WHERE id = $2 AND vidyalaya_id = $3`,
          [item.quantity, item.assetId, vid]
        );

        // Append remark
        await appendMovementRemark(client, item.assetId, vid, 'ISSUED', {
          quantity: item.quantity,
          targetName,
          purpose: params.purpose,
          issueNo,
        });
      }

      // 7. Audit log
      await client.query(
        `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, vidyalaya_id)
         VALUES ('non_consumable_issue_master', $1, 'INSERT', $2, $3, $4)`,
        [master.id, JSON.stringify({
          event: 'NON_CONSUMABLE_ISSUED',
          issue_no: issueNo,
          target_type: params.issueTargetType,
          target_name: targetName,
          item_count: params.items.length,
          total_quantity: params.items.reduce((s, i) => s + i.quantity, 0),
        }), params.issuedByUserId, vid]
      );

      await client.query('COMMIT');
      return { ...master, items: insertedItems };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }


  // ─── RETURN ASSETS ───────────────────────────────────────
  /**
   * Process a return (full or partial) for a non-consumable issue.
   *
   * @param {object} params
   * @param {number} params.vidyalayaId
   * @param {number} params.issueMasterId
   * @param {number} params.returnedByUserId
   * @param {Array}  params.returns - [{ issueItemId, quantityReturning, conditionAtReturn, returnRemarks }]
   * @returns {object} Updated master record
   */
  async returnAssets(params) {
    const client = await db.getTenantClient();
    try {
      await client.query('BEGIN');
      const vid = params.vidyalayaId;

      // 1. Load and validate master
      const { rows: masterRows } = await client.query(
        `SELECT * FROM non_consumable_issue_master
         WHERE id = $1 AND vidyalaya_id = $2 FOR UPDATE`,
        [params.issueMasterId, vid]
      );
      if (masterRows.length === 0) throw new Error('Issue record not found');
      const master = masterRows[0];

      if (master.status === 'RETURNED' || master.status === 'CANCELLED') {
        throw new Error(`Issue ${master.issue_no} is already ${master.status}`);
      }

      // Resolve target name for remarks
      let targetName = '';
      if (master.issue_target_type === 'DEPARTMENT' && master.issued_to_department_id) {
        const { rows } = await client.query(
          `SELECT name FROM operational_department WHERE id = $1 AND vidyalaya_id = $2`,
          [master.issued_to_department_id, vid]
        );
        targetName = rows.length > 0 ? rows[0].name : 'Unknown Dept';
      } else if (master.issued_to_user_id) {
        const { rows } = await client.query(
          `SELECT name FROM "user" WHERE id = $1 AND vidyalaya_id = $2`,
          [master.issued_to_user_id, vid]
        );
        targetName = rows.length > 0 ? rows[0].name : 'Unknown User';
      }

      // 2. Process each return line
      for (const ret of params.returns) {
        // Load item
        const { rows: itemRows } = await client.query(
          `SELECT * FROM non_consumable_issue_items
           WHERE id = $1 AND issue_master_id = $2 FOR UPDATE`,
          [ret.issueItemId, params.issueMasterId]
        );
        if (itemRows.length === 0) throw new Error(`Issue item ${ret.issueItemId} not found`);
        const item = itemRows[0];

        const remaining = item.quantity_issued - item.quantity_returned;
        if (ret.quantityReturning > remaining) {
          throw new Error(
            `Item "${item.asset_name_snapshot}": returning ${ret.quantityReturning}, only ${remaining} outstanding`
          );
        }
        if (ret.quantityReturning <= 0) {
          throw new Error(`Return quantity must be positive`);
        }

        // Update item
        await client.query(
          `UPDATE non_consumable_issue_items
           SET quantity_returned = quantity_returned + $1,
               condition_at_return = $2,
               return_remarks = CASE
                 WHEN return_remarks IS NULL OR return_remarks = '' THEN $3
                 ELSE return_remarks || E'\n' || $3
               END
           WHERE id = $4`,
          [
            ret.quantityReturning,
            ret.conditionAtReturn || null,
            ret.returnRemarks || '',
            ret.issueItemId,
          ]
        );

        // Update asset derived state
        await client.query(
          `UPDATE asset
           SET total_issued_quantity = GREATEST(total_issued_quantity - $1, 0),
               last_movement_at = NOW(),
               updated_at = NOW()
           WHERE id = $2 AND vidyalaya_id = $3`,
          [ret.quantityReturning, item.asset_id, vid]
        );

        // Append remark
        const isPartial = ret.quantityReturning < remaining;
        await appendMovementRemark(client, item.asset_id, vid,
          isPartial ? 'PARTIALLY_RETURNED' : 'RETURNED',
          {
            quantity: ret.quantityReturning,
            targetName,
            condition: ret.conditionAtReturn || 'N/A',
            issueNo: master.issue_no,
          }
        );
      }

      // 3. Determine new master status
      const { rows: allItems } = await client.query(
        `SELECT SUM(quantity_issued) AS total_issued,
                SUM(quantity_returned) AS total_returned
         FROM non_consumable_issue_items WHERE issue_master_id = $1`,
        [params.issueMasterId]
      );
      const totIssued = parseInt(allItems[0].total_issued, 10);
      const totReturned = parseInt(allItems[0].total_returned, 10);

      let newStatus;
      if (totReturned >= totIssued) {
        newStatus = 'RETURNED';
      } else if (totReturned > 0) {
        newStatus = 'PARTIALLY_RETURNED';
      } else {
        newStatus = 'ISSUED';
      }

      const updateFields = ['status = $1', 'updated_at = NOW()'];
      const updateParams = [newStatus];
      if (newStatus === 'RETURNED') {
        updateFields.push('returned_at = NOW()');
      }
      updateParams.push(params.issueMasterId, vid);

      await client.query(
        `UPDATE non_consumable_issue_master
         SET ${updateFields.join(', ')}
         WHERE id = $${updateParams.length - 1} AND vidyalaya_id = $${updateParams.length}`,
        updateParams
      );

      // 4. Audit log
      await client.query(
        `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, vidyalaya_id)
         VALUES ('non_consumable_issue_master', $1, 'UPDATE', $2, $3, $4)`,
        [params.issueMasterId, JSON.stringify({
          event: newStatus === 'RETURNED' ? 'NON_CONSUMABLE_RETURNED' : 'NON_CONSUMABLE_PARTIAL_RETURN',
          issue_no: master.issue_no,
          returned_qty: params.returns.reduce((s, r) => s + r.quantityReturning, 0),
          new_status: newStatus,
        }), params.returnedByUserId, vid]
      );

      await client.query('COMMIT');

      // Return updated master
      const { rows: updated } = await db.query(
        `SELECT * FROM non_consumable_issue_master WHERE id = $1 AND vidyalaya_id = $2`,
        [params.issueMasterId, vid]
      );
      return updated[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }


  // ─── CANCEL ISSUE ────────────────────────────────────────
  /**
   * Cancel an issue that has had no returns.
   */
  async cancelIssue(issueMasterId, vid, userId) {
    const client = await db.getTenantClient();
    try {
      await client.query('BEGIN');

      const { rows: masterRows } = await client.query(
        `SELECT * FROM non_consumable_issue_master
         WHERE id = $1 AND vidyalaya_id = $2 FOR UPDATE`,
        [issueMasterId, vid]
      );
      if (masterRows.length === 0) throw new Error('Issue record not found');
      const master = masterRows[0];

      // Revert asset quantities
      const { rows: items } = await client.query(
        `SELECT * FROM non_consumable_issue_items WHERE issue_master_id = $1`,
        [issueMasterId]
      );

      // Resolve target name for remarks
      let targetName = 'Unknown';
      if (master.issue_target_type === 'DEPARTMENT' && master.issued_to_department_id) {
        const { rows: d } = await client.query(
          `SELECT name FROM operational_department WHERE id = $1 AND vidyalaya_id = $2`,
          [master.issued_to_department_id, vid]
        );
        if (d.length > 0) targetName = d[0].name;
      } else if (master.issued_to_user_id) {
        const { rows: u } = await client.query(
          `SELECT name FROM "user" WHERE id = $1 AND vidyalaya_id = $2`,
          [master.issued_to_user_id, vid]
        );
        if (u.length > 0) targetName = u[0].name;
      }

      for (const item of items) {
        await client.query(
          `UPDATE asset
           SET total_issued_quantity = GREATEST(total_issued_quantity - $1, 0),
               last_movement_at = NOW(),
               updated_at = NOW()
           WHERE id = $2 AND vidyalaya_id = $3`,
          [item.quantity_issued, item.asset_id, vid]
        );

        await appendMovementRemark(client, item.asset_id, vid, 'CANCELLED', {
          quantity: item.quantity_issued,
          targetName,
          issueNo: master.issue_no,
        });
      }

      // The status transition trigger will validate this is allowed
      await client.query(
        `UPDATE non_consumable_issue_master
         SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND vidyalaya_id = $2`,
        [issueMasterId, vid]
      );

      // Audit
      await client.query(
        `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, vidyalaya_id)
         VALUES ('non_consumable_issue_master', $1, 'UPDATE', $2, $3, $4)`,
        [issueMasterId, JSON.stringify({
          event: 'NON_CONSUMABLE_ISSUE_CANCELLED',
          issue_no: master.issue_no,
        }), userId, vid]
      );

      await client.query('COMMIT');
      return { success: true, issue_no: master.issue_no };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new NonConsumableMovementService();
