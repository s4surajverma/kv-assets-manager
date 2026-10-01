const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const { success, created, error } = require('../utils/responseHelper');

// ─────────────────────────────────────────────────────────────
// GET /api/v1/disposals  — list all disposal records
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;

    const { rows } = await db.query(
      `SELECT
         disp.id, disp.disposal_mode, disp.disposal_date,
         disp.reserve_price, disp.sale_amount, disp.buyer_name,
         disp.is_hazardous, disp.payment_received, disp.remarks,
         disp.condemnation_id, disp.condemnation_master_id,
         disp.created_at,
         s.sanction_no, s.sanction_date, s.sanctioned_amount,
         -- Legacy single-asset info
         ce_a.asset_number  AS legacy_asset_number,
         ce_a.name          AS legacy_asset_name,
         ce.condemnation_cost AS legacy_condemn_value,
         ce.status           AS legacy_condemn_status,
         -- Master multi-asset info
         cm.total_condemnation_cost AS master_condemn_value,
         cm.status                  AS master_condemn_status,
         (SELECT COUNT(*) FROM condemnation_items ci WHERE ci.condemnation_master_id = cm.id) AS master_item_count,
         od.name AS operational_department_name,
         fh.code AS fund_code,
         (SELECT d.name FROM condemnation_items ci JOIN department d ON d.id = ci.department_id WHERE ci.condemnation_master_id = cm.id LIMIT 1) AS master_asset_head_name
       FROM disposal disp
       LEFT JOIN sanction s ON s.id = disp.sanction_id AND s.vidyalaya_id = $1
       -- Legacy joins
       LEFT JOIN condemnation_entry ce ON ce.id = disp.condemnation_id AND ce.vidyalaya_id = $1
       LEFT JOIN asset ce_a ON ce_a.id = ce.asset_id
       -- Master joins
       LEFT JOIN condemnation_master cm ON cm.id = disp.condemnation_master_id AND cm.vidyalaya_id = $1
       LEFT JOIN operational_department od ON od.id = cm.operational_department_id
       LEFT JOIN funding_head fh ON fh.id = cm.funding_head_id
       WHERE disp.vidyalaya_id = $1
       ORDER BY disp.created_at DESC`,
      [vid]
    );
    success(res, rows);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/disposals/:id  — single disposal with full details
// ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT disp.*,
              s.sanction_no, s.sanction_date, s.sanctioned_amount, s.sanctioning_authority,
              s.comments AS sanction_comments,
              u_cr.name AS created_by_name,
              u_sv.name AS supervised_by_name,
              v.kv_name_en, v.kv_name_hi, v.kv_code,
              -- Legacy
              ce.status AS legacy_condemn_status,
              ce_a.asset_number AS legacy_asset_number, ce_a.name AS legacy_asset_name,
              ce_a.purchase_date AS legacy_purchase_date, ce_a.total_cost AS legacy_original_cost,
              ce.condemnation_cost AS legacy_condemn_value,
              ce_d.name AS legacy_dept_name, ce_fh.code AS legacy_fund_code,
              -- Master
              cm.status AS master_condemn_status,
              cm.total_original_cost AS master_original_cost,
              cm.total_condemnation_cost AS master_condemn_value,
              cm.financial_year AS master_fy,
              cm.depreciation_method AS master_depr_method,
              od.name AS operational_department_name,
              m_fh.code AS master_fund_code,
              (SELECT d.name FROM condemnation_items ci JOIN department d ON d.id = ci.department_id WHERE ci.condemnation_master_id = cm.id LIMIT 1) AS master_asset_head_name
       FROM disposal disp
       LEFT JOIN sanction s ON s.id = disp.sanction_id AND s.vidyalaya_id = $2
       LEFT JOIN "user" u_cr ON u_cr.id = disp.created_by
       LEFT JOIN "user" u_sv ON u_sv.id = disp.supervised_by
       LEFT JOIN vidyalaya v ON v.id = disp.vidyalaya_id
       -- Legacy joins
       LEFT JOIN condemnation_entry ce ON ce.id = disp.condemnation_id AND ce.vidyalaya_id = $2
       LEFT JOIN asset ce_a ON ce_a.id = ce.asset_id
       LEFT JOIN department ce_d ON ce_d.id = ce.department_id
       LEFT JOIN funding_head ce_fh ON ce_fh.id = ce.funding_head_id
       -- Master joins
       LEFT JOIN condemnation_master cm ON cm.id = disp.condemnation_master_id AND cm.vidyalaya_id = $2
       LEFT JOIN operational_department od ON od.id = cm.operational_department_id
       LEFT JOIN funding_head m_fh ON m_fh.id = cm.funding_head_id
       WHERE disp.id = $1 AND disp.vidyalaya_id = $2`,
      [id, vid]
    );
    if (rows.length === 0) return error(res, 'Disposal not found', 404);

    const disp = rows[0];

    // Fetch condemnation items for master flow
    let items = [];
    if (disp.condemnation_master_id) {
      const { rows: masterItems } = await db.query(
        `SELECT ci.*,
                a.asset_number, a.name AS asset_name, a.machine_no,
                a.purchase_date, a.total_cost AS original_cost,
                d.name AS asset_head_name,
                sl.stock_volume_no, sl.stock_page_no
         FROM condemnation_items ci
         JOIN asset a ON a.id = ci.asset_id
         JOIN department d ON d.id = ci.department_id
         LEFT JOIN stock_ledger sl ON sl.id = a.stock_ledger_id
         WHERE ci.condemnation_master_id = $1
         ORDER BY a.name`,
        [disp.condemnation_master_id]
      );
      items = masterItems;
    } else if (disp.condemnation_id) {
      // Legacy: single item
      items = [{
        asset_number: disp.legacy_asset_number,
        asset_name: disp.legacy_asset_name,
        purchase_date: disp.legacy_purchase_date,
        original_cost: disp.legacy_original_cost,
        condemnation_cost: disp.legacy_condemn_value,
      }];
    }

    success(res, { disposal: disp, items });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/disposals
// Accepts condemnation_id (legacy) or condemnation_master_id (new)
// ─────────────────────────────────────────────────────────────
router.post('/', authorize('Admin'),
  [
    body('sanction_id').isInt(),
    body('disposal_mode').isIn(['ADVERTISED_TENDER','PUBLIC_AUCTION','SCRAP_SALE','DESTRUCTION','TRANSFER','OTHER']),
    body('disposal_date').isDate(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const b = req.body;

      // Validate exactly one condemnation source
      if (b.condemnation_ref) {
        if (b.condemnation_ref.startsWith('legacy-')) {
          b.condemnation_id = parseInt(b.condemnation_ref.replace('legacy-', ''));
        } else if (b.condemnation_ref.startsWith('master-')) {
          b.condemnation_master_id = parseInt(b.condemnation_ref.replace('master-', ''));
        }
      }

      if (!b.condemnation_id && !b.condemnation_master_id)
        return error(res, 'Must provide either condemnation_id, condemnation_master_id or condemnation_ref', 400);
      if (b.condemnation_id && b.condemnation_master_id)
        return error(res, 'Provide only one source reference', 400);

      if (b.reserve_price && parseFloat(b.reserve_price) > 400000) {
        if (!['ADVERTISED_TENDER', 'PUBLIC_AUCTION'].includes(b.disposal_mode)) {
          return error(res, 'Residual value > Rs.4,00,000 requires advertised tender or public auction', 400);
        }
      }

      // Check if disposal already exists for this condemnation record
      let existingQuery = '';
      let existingParams = [];
      if (b.condemnation_id) {
        existingQuery = 'SELECT id FROM disposal WHERE condemnation_id = $1 AND vidyalaya_id = $2';
        existingParams = [b.condemnation_id, vid];
      } else {
        existingQuery = 'SELECT id FROM disposal WHERE condemnation_master_id = $1 AND vidyalaya_id = $2';
        existingParams = [b.condemnation_master_id, vid];
      }
      const { rows: existing } = await db.query(existingQuery, existingParams);
      if (existing.length > 0) {
        return error(res, 'A disposal record has already been created for this condemnation reference', 400);
      }

      const { rows } = await db.query(
        `INSERT INTO disposal
         (condemnation_id, condemnation_master_id, sanction_id, disposal_mode, disposal_date,
          reserve_price, is_hazardous, recycler_registration, remarks, created_by, vidyalaya_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          b.condemnation_id || null,
          b.condemnation_master_id || null,
          b.sanction_id, b.disposal_mode, b.disposal_date,
          b.reserve_price, b.is_hazardous || false, b.recycler_registration,
          b.remarks, req.user.id, vid,
        ]
      );
      created(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/disposals/:id/sale
// ─────────────────────────────────────────────────────────────
router.put('/:id/sale', authorize('Admin'),
  [body('buyer_name').notEmpty(), body('sale_amount').isFloat({ min: 0 })],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const { buyer_name, buyer_address, sale_amount, earnest_money } = req.body;
      const { rows: disp } = await db.query('SELECT reserve_price FROM disposal WHERE id = $1 AND vidyalaya_id = $2', [req.params.id, vid]);
      if (disp.length === 0) return error(res, 'Disposal not found', 404);
      if (disp[0].reserve_price && earnest_money) {
        const minEarnest = parseFloat(disp[0].reserve_price) * 0.10;
        if (parseFloat(earnest_money) < minEarnest)
          return error(res, `Earnest money must be >= 10% of reserve price (Rs.${minEarnest})`, 400);
      }
      const { rows } = await db.query(
        `UPDATE disposal SET buyer_name=$1, buyer_address=$2, sale_amount=$3, earnest_money=$4
         WHERE id=$5 AND vidyalaya_id=$6 RETURNING *`,
        [buyer_name, buyer_address, sale_amount, earnest_money, req.params.id, vid]
      );
      success(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/v1/disposals/:id/complete
// Marks disposal complete + updates condemnation + assets to DISPOSED
// ─────────────────────────────────────────────────────────────
router.post('/:id/complete', authorize('Admin'),
  [body('payment_date').isDate(), body('supervised_by').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const { rows } = await db.query(
        `UPDATE disposal SET payment_received = true, payment_date = $1, supervised_by = $2
         WHERE id = $3 AND vidyalaya_id = $4 RETURNING *`,
        [req.body.payment_date, req.body.supervised_by, req.params.id, vid]
      );
      if (rows.length === 0) return error(res, 'Disposal not found', 404);

      const d = rows[0];

      if (d.condemnation_master_id) {
        // New flow — update master status + all items' assets to DISPOSED
        await db.query(
          `UPDATE condemnation_master SET status = 'DISPOSED', updated_at = NOW()
           WHERE id = $1 AND vidyalaya_id = $2`,
          [d.condemnation_master_id, vid]
        );
        await db.pool.query(
          `UPDATE asset SET status = 'DISPOSED', updated_at = NOW()
           WHERE id IN (SELECT asset_id FROM condemnation_items WHERE condemnation_master_id = $1)`,
          [d.condemnation_master_id]
        );
        await db.rawQuery(
          `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by)
           VALUES ('condemnation_master', $1, 'UPDATE', $2, $3)`,
          [d.condemnation_master_id, JSON.stringify({ event: 'DISPOSED', payment_date: req.body.payment_date }), req.user.id]
        );
      } else if (d.condemnation_id) {
        // Legacy flow
        await db.query(
          `UPDATE condemnation_entry SET status = 'DISPOSED', updated_at = NOW()
           WHERE id = $1 AND vidyalaya_id = $2`,
          [d.condemnation_id, vid]
        );
        const { rows: ce } = await db.query(
          'SELECT asset_id FROM condemnation_entry WHERE id = $1 AND vidyalaya_id = $2',
          [d.condemnation_id, vid]
        );
        if (ce.length > 0) {
          await db.pool.query(
            `UPDATE asset SET status = 'DISPOSED', updated_at = NOW() WHERE id = $1`,
            [ce[0].asset_id]
          );
        }
      }

      success(res, rows[0]);
    } catch (err) { next(err); }
  }
);

module.exports = router;
