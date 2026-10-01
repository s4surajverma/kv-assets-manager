const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const sanctionService = require('../services/SanctionService');
const fyUtils = require('../utils/financialYear');
const { success, created, error } = require('../utils/responseHelper');

// ─────────────────────────────────────────────────────────────
// POST /api/v1/sanctions
// Accepts either condemnation_id (legacy) or condemnation_master_id (new)
// ─────────────────────────────────────────────────────────────
router.post('/', authorize('Admin'),
  [body('sanction_no').notEmpty(), body('sanction_date').isDate()],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      let { condemnation_id, condemnation_master_id, condemnation_ref, sanction_no, sanction_date, comments } = req.body;

      if (condemnation_ref) {
        if (condemnation_ref.startsWith('legacy-')) {
          condemnation_id = parseInt(condemnation_ref.replace('legacy-', ''));
        } else if (condemnation_ref.startsWith('master-')) {
          condemnation_master_id = parseInt(condemnation_ref.replace('master-', ''));
        }
      }

      // Validate exactly one source provided
      if (!condemnation_id && !condemnation_master_id)
        return error(res, 'Must provide either condemnation_id or condemnation_master_id (or ref)', 400);
      if (condemnation_id && condemnation_master_id)
        return error(res, 'Provide only one source reference', 400);

      let amount, fy, sourceStatus;

      if (condemnation_master_id) {
        // ── New multi-asset flow ──
        const { rows: cm } = await db.query(
          'SELECT * FROM condemnation_master WHERE id = $1 AND vidyalaya_id = $2',
          [condemnation_master_id, vid]
        );
        if (cm.length === 0) return error(res, 'Condemnation not found', 404);
        if (cm[0].status !== 'BOARD_REVIEWED')
          return error(res, 'Condemnation must be board-reviewed before sanctioning', 400);
        amount = parseFloat(cm[0].total_condemnation_cost);
        fy     = cm[0].financial_year;
        sourceStatus = 'master';
      } else {
        // ── Legacy single-asset flow ──
        const { rows: ce } = await db.query(
          'SELECT * FROM condemnation_entry WHERE id = $1 AND vidyalaya_id = $2',
          [condemnation_id, vid]
        );
        if (ce.length === 0) return error(res, 'Condemnation not found', 404);
        if (ce[0].status !== 'BOARD_REVIEWED')
          return error(res, 'Condemnation must be board-reviewed first', 400);
        amount = parseFloat(ce[0].condemnation_cost);
        fy     = ce[0].financial_year;
        sourceStatus = 'legacy';
      }

      const authority = await sanctionService.autoRoute(amount, fy);
      await sanctionService.validateSanction(amount, authority, fy);

      // Insert sanction with the appropriate FK
      const { rows } = await db.query(
        `INSERT INTO sanction
           (sanction_no, sanction_date, condemnation_id, condemnation_master_id,
            sanctioning_authority, sanctioned_by, sanctioned_amount, financial_year, comments, vidyalaya_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          sanction_no, sanction_date,
          condemnation_id   || null,
          condemnation_master_id || null,
          authority, req.user.id, amount, fy, comments, vid,
        ]
      );

      // Update condemnation status to SANCTIONED + mark assets CONDEMNED
      if (sourceStatus === 'master') {
        await db.query(
          `UPDATE condemnation_master SET status = 'SANCTIONED', updated_at = NOW()
           WHERE id = $1 AND vidyalaya_id = $2`,
          [condemnation_master_id, vid]
        );
        // Update all items' assets to CONDEMNED
        await db.query(
          `UPDATE asset SET status = 'CONDEMNED', updated_at = NOW()
           WHERE id IN (SELECT asset_id FROM condemnation_items WHERE condemnation_master_id = $1)`,
          [condemnation_master_id]
        );
        await db.rawQuery(
          `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by)
           VALUES ('condemnation_master', $1, 'UPDATE', $2, $3)`,
          [condemnation_master_id, JSON.stringify({ event: 'SANCTIONED', sanction_no, amount }), req.user.id]
        );

        // Auto-generate WRITE_OFF stock entries for master flow
        const { rows: itemsToWritoff } = await db.query(
          `SELECT ci.quantity_condemned, sl.*
           FROM condemnation_items ci
           JOIN asset a ON a.id = ci.asset_id
           JOIN stock_ledger sl ON sl.id = a.stock_ledger_id
           WHERE ci.condemnation_master_id = $1`,
          [condemnation_master_id]
        );
        for (const o of itemsToWritoff) {
          await db.query(
            `INSERT INTO stock_ledger
             (ledger_type, entry_type, is_consumable, funding_head_id, department_id, operational_department_id,
              financial_year, entry_date, item_description, machine_no, code_no,
              quantity, rate, amount, location_id, in_charge_id,
              sanction_no, sanction_date, remarks, created_by, classification_status, vidyalaya_id)
             VALUES ($1, 'WRITE_OFF', $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'CLASSIFIED', $19)`,
            [
              o.ledger_type, o.is_consumable, o.funding_head_id, o.department_id, o.operational_department_id,
              fy, o.item_description, o.machine_no, o.code_no,
              o.quantity_condemned || 1, o.rate, o.amount, o.location_id, o.in_charge_id,
              sanction_no, sanction_date,
              `Condemnation Sanctioned`, req.user.id, vid
            ]
          );
        }
      } else {
        await db.query(
          `UPDATE condemnation_entry SET status = 'SANCTIONED', updated_at = NOW()
           WHERE id = $1 AND vidyalaya_id = $2`,
          [condemnation_id, vid]
        );

        // Auto-generate WRITE_OFF stock entry for legacy flow
        const { rows: legacyItems } = await db.query(
          `SELECT sl.*
           FROM condemnation_entry ce
           JOIN asset a ON a.id = ce.asset_id
           JOIN stock_ledger sl ON sl.id = a.stock_ledger_id
           WHERE ce.id = $1`,
          [condemnation_id]
        );
        for (const o of legacyItems) {
          await db.query(
            `INSERT INTO stock_ledger
             (ledger_type, entry_type, is_consumable, funding_head_id, department_id, operational_department_id,
              financial_year, entry_date, item_description, machine_no, code_no,
              quantity, rate, amount, location_id, in_charge_id,
              sanction_no, sanction_date, remarks, created_by, classification_status, vidyalaya_id)
             VALUES ($1, 'WRITE_OFF', $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'CLASSIFIED', $19)`,
            [
              o.ledger_type, o.is_consumable, o.funding_head_id, o.department_id, o.operational_department_id,
              fy, o.item_description, o.machine_no, o.code_no,
              1, o.rate, o.amount, o.location_id, o.in_charge_id,
              sanction_no, sanction_date,
              `Condemnation Sanctioned`, req.user.id, vid
            ]
          );
        }
      }

      created(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /api/v1/sanctions
// Lists both legacy and new sanctions
// ─────────────────────────────────────────────────────────────
router.get('/', authorize('Admin'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { fy, authority } = req.query;
    let sql = `SELECT s.*, u.name AS sanctioned_by_name, u.employee_code AS sanctioned_by_empcode,
                      -- Legacy fields
                      ce.condemnation_no, a.asset_number,
                      -- New master fields
                      cm.operational_department_id, od.name AS operational_department_name
               FROM sanction s
               LEFT JOIN condemnation_entry ce ON ce.id = s.condemnation_id
               LEFT JOIN asset a ON a.id = ce.asset_id
               LEFT JOIN condemnation_master cm ON cm.id = s.condemnation_master_id
               LEFT JOIN operational_department od ON od.id = cm.operational_department_id
               JOIN "user" u ON u.id = s.sanctioned_by`;
    const params = [vid];
    const where = ['s.vidyalaya_id = $1'];
    if (fy)        { params.push(fy);        where.push(`s.financial_year = $${params.length}`); }
    if (authority) { params.push(authority); where.push(`s.sanctioning_authority = $${params.length}`); }
    sql += ' WHERE ' + where.join(' AND ') + ' ORDER BY s.sanction_date DESC';
    const { rows } = await db.query(sql, params);
    success(res, rows);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/sanctions/limits
// ─────────────────────────────────────────────────────────────
router.get('/limits', authorize('Admin'), async (req, res, next) => {
  try {
    const { authority, fy } = req.query;
    const financialYear = fy || fyUtils.current();
    const data = await sanctionService.getLimits(authority || 'VMC', financialYear);
    success(res, data);
  } catch (err) { next(err); }
});

module.exports = router;
