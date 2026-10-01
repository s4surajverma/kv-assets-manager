const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const condemnationCalcService = require('../services/CondemnationCalcService');
const fyUtils = require('../utils/financialYear');
const { success, created, error } = require('../utils/responseHelper');

// Helper: add condemnation_master / condemnation_items to global-skip list
// These ARE tenant tables, so their vidyalaya_id is enforced by the tenant wrapper.
// audit_log has no vidyalaya_id — use rawQuery for it.

// ─────────────────────────────────────────────────────────────
// GET /api/v1/condemnations/eligible-assets
// Fetch CAPITAL, ACTIVE assets for a given op-dept + funding head
// ─────────────────────────────────────────────────────────────
router.get('/eligible-assets', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { operational_department_id, funding_head_id } = req.query;
    if (!operational_department_id || !funding_head_id)
      return error(res, 'operational_department_id and funding_head_id are required', 400);

    const { rows } = await db.query(
      `SELECT
         a.id, a.asset_number, a.name, a.machine_no, a.description,
         a.purchase_date, a.unit_cost AS article_rate,
         a.total_cost AS original_cost,
         a.book_value, a.accum_depreciation,
         a.status, a.asset_classification,
         d.id   AS department_id,
         d.name AS asset_head_name,
         d.code AS asset_head_code,
         fh.id   AS funding_head_id,
         fh.code AS fund_code,
         sl.stock_volume_no, sl.stock_page_no
       FROM asset a
       JOIN department   d  ON d.id  = a.department_id
       JOIN funding_head fh ON fh.id = a.funding_head_id
       LEFT JOIN stock_ledger sl ON sl.id = a.stock_ledger_id
       WHERE
         a.vidyalaya_id              = $1
         AND a.operational_department_id = $2
         AND a.funding_head_id           = $3
         AND a.status                    = 'ACTIVE'
         AND a.asset_classification      = 'CAPITAL'
         AND a.stock_ledger_id IS NOT NULL
         AND a.book_value      IS NOT NULL
         AND a.id NOT IN (SELECT asset_id FROM condemnation_items)
         AND a.id NOT IN (
           SELECT asset_id FROM condemnation_entry WHERE status NOT IN ('REJECTED')
         )
       ORDER BY a.name`,
      [vid, operational_department_id, funding_head_id]
    );
    success(res, rows);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/condemnations/calculate-bulk
// In-memory depreciation preview — no DB write
// ─────────────────────────────────────────────────────────────
router.post('/calculate-bulk',
  [body('asset_ids').isArray({ min: 1 }), body('depreciation_method').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { asset_ids, depreciation_method } = req.body;
      const calcs = await Promise.all(
        asset_ids.map(id => condemnationCalcService.compute(id, depreciation_method))
      );
      const deprWarnings = [];
      const vid = req.user.vidyalaya_id;
      for (const id of asset_ids) {
        const check = await condemnationCalcService.pendingDepreciationCheck(id, vid);
        if (check.hasPending) {
          deprWarnings.push({ asset_id: id, message: check.message });
        }
      }

      const totals = calcs.reduce((acc, c) => ({
        total_original_cost:    acc.total_original_cost    + c.original_cost,
        total_depreciation:     acc.total_depreciation     + c.total_depreciation,
        total_condemnation_cost:acc.total_condemnation_cost+ c.condemnation_cost,
        total_depreciated_value:acc.total_depreciated_value+ c.depreciated_value,
      }), { total_original_cost:0, total_depreciation:0, total_condemnation_cost:0, total_depreciated_value:0 });
      success(res, { items: calcs, totals, depreciation_warnings: deprWarnings });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/v1/condemnations  — create multi-asset condemnation
// Entire flow in a single transaction with SELECT FOR UPDATE
// ─────────────────────────────────────────────────────────────
router.post('/', authorize('StockHolder'),
  [
    body('operational_department_id').isInt(),
    body('funding_head_id').isInt(),
    body('depreciation_method').notEmpty(),
    body('reason').notEmpty(),
    body('items').isArray({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    const client = await db.getTenantClient();
    try {
      await client.query('BEGIN');
      const vid = req.user.vidyalaya_id;
      const { operational_department_id, funding_head_id, depreciation_method,
              reason, date_unserviceable, items } = req.body;
      const method = depreciation_method || 'BOTH';
      const asset_ids = items.map(i => i.asset_id);

      // STEP 1 — Lock rows to prevent concurrent double-condemnation
      // Use rawQuery for FOR UPDATE (tenant wrapper parses it as SELECT)
      const { rows: assetRows } = await db.pool.query(
        `SELECT id, department_id, funding_head_id, status, asset_classification
         FROM asset WHERE id = ANY($1) AND vidyalaya_id = $2 FOR UPDATE`,
        [asset_ids, vid]
      );

      // STEP 2 — All found?
      if (assetRows.length !== asset_ids.length)
        throw Object.assign(new Error('One or more assets not found or inaccessible'), { statusCode: 400 });

      // STEP 3 — CAPITAL only
      const nonCapital = assetRows.filter(r => r.asset_classification !== 'CAPITAL');
      if (nonCapital.length > 0)
        throw Object.assign(new Error(`Assets [${nonCapital.map(r=>r.id).join(',')}] are not CAPITAL assets`), { statusCode: 400 });

      // STEP 4 — All ACTIVE
      const notActive = assetRows.filter(r => r.status !== 'ACTIVE');
      if (notActive.length > 0)
        throw Object.assign(new Error(`Assets [${notActive.map(r=>r.id).join(',')}] are not ACTIVE`), { statusCode: 400 });

      // STEP 5 — Same Asset Head
      const uniqueDepts = [...new Set(assetRows.map(r => r.department_id))];
      if (uniqueDepts.length > 1)
        throw Object.assign(new Error('All assets must belong to the same Asset Head. Mixed categories not allowed.'), { statusCode: 400 });

      // STEP 6 — Same Funding Head
      const uniqueFunds = [...new Set(assetRows.map(r => r.funding_head_id))];
      if (uniqueFunds.length > 1)
        throw Object.assign(new Error('All assets must belong to the same Funding Head. Mixed funds not allowed.'), { statusCode: 400 });

      // Funding head consistency with submitted value
      if (uniqueFunds[0] !== parseInt(funding_head_id))
        throw Object.assign(new Error('Funding head mismatch between selected assets and submitted value'), { statusCode: 400 });

      // STEP 6.5 — Depreciation currency check (Phase 4 integration)
      // Warn if any asset has suspicious depreciation state (FY run done but asset missing)
      // Non-blocking: logs warning but allows condemnation to proceed for operational flexibility
      const deprWarnings = [];
      for (const assetId of asset_ids) {
        const check = await condemnationCalcService.pendingDepreciationCheck(assetId, vid);
        if (check.hasPending) {
          deprWarnings.push({ asset_id: assetId, message: check.message });
        }
      }
      // If there are hard warnings (future: could make this blocking based on config)
      // For now: attach warnings to the response, allow execution

      // STEP 7 — Run ledger-driven calculations
      const calcs = await Promise.all(asset_ids.map(id => condemnationCalcService.compute(id, method)));

      // STEP 8 — Aggregate totals
      const totals = calcs.reduce((acc, c) => ({
        total_original_cost:    acc.total_original_cost    + c.original_cost,
        total_depreciation:     acc.total_depreciation     + c.total_depreciation,
        total_condemnation_cost:acc.total_condemnation_cost+ c.condemnation_cost,
        total_depreciated_value:acc.total_depreciated_value+ c.depreciated_value,
      }), { total_original_cost:0, total_depreciation:0, total_condemnation_cost:0, total_depreciated_value:0 });

      // STEP 9 — Insert condemnation_master
      const fy = fyUtils.current();
      const { rows: [master] } = await client.query(
        `INSERT INTO condemnation_master
           (vidyalaya_id, operational_department_id, funding_head_id, financial_year,
            depreciation_method, reason, date_unserviceable,
            total_original_cost, total_depreciation, total_condemnation_cost, total_depreciated_value,
            created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [vid, operational_department_id, funding_head_id, fy, method, reason,
         date_unserviceable || null,
         totals.total_original_cost, totals.total_depreciation,
         totals.total_condemnation_cost, totals.total_depreciated_value,
         req.user.id]
      );

      // STEP 10 — Insert condemnation_items with immutable snapshot fields (Phase 4)
      const assetMap = Object.fromEntries(assetRows.map(r => [r.id, r]));
      for (const [i, item] of items.entries()) {
        const calc = calcs[i];
        const assetRow = assetMap[item.asset_id];
        await client.query(
          `INSERT INTO condemnation_items
             (condemnation_master_id, asset_id, department_id,
              quantity_condemned, original_cost, total_depreciation,
              cap_95_value, condemnation_cost, depreciated_value,
              depr_pre_2011, depr_post_2011, years_pre_2011, years_post_2011,
              slm_rate_pre, wdv_rate_post,
              date_unserviceable, model_serial_no, remarks,
              book_value_at_condemnation, depreciation_method, policy_version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
          [
            master.id, item.asset_id, assetRow.department_id,
            item.quantity_condemned || 1,
            calc.original_cost, calc.total_depreciation,
            calc.cap_95, calc.condemnation_cost, calc.depreciated_value,
            calc.depr_pre_2011, calc.depr_post_2011,
            calc.years_pre_2011, calc.years_post_2011,
            calc.slm_rate_pre, calc.wdv_rate_post,
            item.date_unserviceable || null,
            item.model_serial_no || null,
            item.remarks || null,
            // Immutable snapshot fields — frozen at condemnation time
            calc.book_value_at_condemnation,
            calc.depreciation_method,
            calc.policy_version,
          ]
        );
      }

      // STEP 11 — Update asset status to UNDER_CONDEMNATION
      await client.query(
        `UPDATE asset SET status = 'UNDER_CONDEMNATION', updated_at = NOW() WHERE id = ANY($1)`,
        [asset_ids]
      );

      // STEP 12 — Audit log (audit_log has no vidyalaya_id, use rawQuery)
      await db.rawQuery(
        `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by)
         VALUES ('condemnation_master', $1, 'INSERT', $2, $3)`,
        [master.id, JSON.stringify({
          event: 'CONDEMNATION_CREATED',
          operational_department_id, funding_head_id,
          item_count: items.length,
          total_original_cost: totals.total_original_cost,
          total_condemnation_cost: totals.total_condemnation_cost,
        }), req.user.id]
      );

      await client.query('COMMIT');
      created(res, { ...master, item_count: items.length, depreciation_warnings: deprWarnings });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /api/v1/condemnations  — unified list (new + legacy)
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { status, type } = req.query;

    // New master records
    let masterRows = [];
    if (type !== 'legacy') {
      let sql = `SELECT cm.id, 'master' AS type, cm.status, cm.financial_year,
                        cm.total_original_cost, cm.total_condemnation_cost, cm.created_at,
                        od.name AS operational_department_name,
                        fh.code AS fund_code,
                        d.name  AS asset_head_name,
                        (SELECT COUNT(*) FROM condemnation_items ci WHERE ci.condemnation_master_id = cm.id) AS item_count
                 FROM condemnation_master cm
                 JOIN operational_department od ON od.id = cm.operational_department_id
                 JOIN funding_head fh ON fh.id = cm.funding_head_id
                 LEFT JOIN condemnation_items ci2 ON ci2.condemnation_master_id = cm.id
                 LEFT JOIN department d ON d.id = ci2.department_id
                 WHERE cm.vidyalaya_id = $1`;
      const params = [vid];
      if (status) { params.push(status); sql += ` AND cm.status = $${params.length}`; }
      sql += ' GROUP BY cm.id, od.name, fh.code, d.name ORDER BY cm.created_at DESC';
      const { rows } = await db.query(sql, params);
      masterRows = rows;
    }

    // Legacy condemnation_entry records
    let legacyRows = [];
    if (type !== 'new') {
      let sql = `SELECT ce.id, 'legacy' AS type, ce.status, ce.financial_year,
                        ce.original_cost AS total_original_cost,
                        ce.condemnation_cost AS total_condemnation_cost, ce.created_at,
                        NULL AS operational_department_name,
                        fh.code AS fund_code,
                        d.name AS asset_head_name,
                        a.name AS asset_name, a.asset_number,
                        1 AS item_count
                 FROM condemnation_entry ce
                 JOIN asset a ON a.id = ce.asset_id
                 JOIN department d ON d.id = ce.department_id
                 JOIN funding_head fh ON fh.id = ce.funding_head_id
                 WHERE ce.vidyalaya_id = $1`;
      const params = [vid];
      if (status) { params.push(status); sql += ` AND ce.status = $${params.length}`; }
      sql += ' ORDER BY ce.created_at DESC';
      const { rows } = await db.query(sql, params);
      legacyRows = rows;
    }

    success(res, [...masterRows, ...legacyRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/condemnations/:id  — auto-detect old vs new
// ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    let rawId = req.params.id;
    let type = req.query.type; // Optional fallback

    if (rawId.startsWith('legacy-')) {
      type = 'legacy';
      rawId = rawId.replace('legacy-', '');
    } else if (rawId.startsWith('master-')) {
      type = 'master';
      rawId = rawId.replace('master-', '');
    }

    const id = parseInt(rawId);
    const vid = req.user.vidyalaya_id;

    // Try new master first
    if (type !== 'legacy') {
      const { rows: masterRows } = await db.query(
        `SELECT cm.*,
                od.name AS operational_department_name, od.code AS operational_department_code,
                fh.code AS fund_code, fh.name AS fund_name,
                v.kv_name_en, v.kv_name_hi, v.kv_code,
                u_si.name AS stock_incharge_name, u_si.employee_code AS stock_incharge_empcode,
                u_si.designation AS stock_incharge_designation,
                u_ck.name AS checker_name, u_ck.employee_code AS checker_empcode
         FROM condemnation_master cm
         JOIN operational_department od ON od.id = cm.operational_department_id
         JOIN funding_head fh ON fh.id = cm.funding_head_id
         JOIN vidyalaya v ON v.id = cm.vidyalaya_id
         LEFT JOIN "user" u_si ON u_si.id = cm.stock_incharge_id
         LEFT JOIN "user" u_ck ON u_ck.id = cm.checker_id
         WHERE cm.id = $1 AND cm.vidyalaya_id = $2`,
        [id, vid]
      );

      if (masterRows.length > 0) {
        // Fetch items
        const { rows: items } = await db.query(
          `SELECT ci.*,
                  a.asset_number, a.name AS asset_name, a.machine_no,
                  a.description AS asset_description, a.purchase_date,
                  d.name AS asset_head_name, d.code AS asset_head_code,
                  dr.life_years AS life_fixed_by_kvs,
                  sl.rate AS article_rate, sl.stock_volume_no, sl.stock_page_no,
                  u_ic.name AS incharge_name, u_ic.designation AS incharge_designation
           FROM condemnation_items ci
           JOIN asset a ON a.id = ci.asset_id
           JOIN department d ON d.id = ci.department_id
           LEFT JOIN depreciation_rule dr ON dr.id = a.depreciation_rule_id
           LEFT JOIN stock_ledger sl ON sl.id = a.stock_ledger_id
           LEFT JOIN "user" u_ic ON u_ic.id = a.in_charge_id
           WHERE ci.condemnation_master_id = $1
           ORDER BY a.name`,
          [id]
        );
        // Fetch linked sanction / disposal
        const { rows: sanction } = await db.query(
          'SELECT * FROM sanction WHERE condemnation_master_id = $1 AND vidyalaya_id = $2', [id, vid]
        );
        const { rows: disposal } = await db.query(
          'SELECT * FROM disposal WHERE condemnation_master_id = $1 AND vidyalaya_id = $2', [id, vid]
        );
        return success(res, {
          ...masterRows[0], type: 'master', items,
          sanction: sanction[0] || null, disposal: disposal[0] || null,
        });
      }
    }

    // Fallback: legacy condemnation_entry
    if (type !== 'master') {
      const { rows } = await db.query(
      `SELECT ce.*,
              a.asset_number, a.name AS asset_name, a.purchase_date,
              a.machine_no, a.description AS asset_description,
              d.code AS dept_code, d.name AS dept_name,
              fh.code AS fund_code, fh.name AS fund_name,
              dr.life_years AS life_fixed_by_kvs,
              v.kv_name_en, v.kv_name_hi, v.kv_code,
              u_si.name AS stock_incharge_name, u_si.employee_code AS stock_incharge_empcode,
              u_si.designation AS stock_incharge_designation,
              u_ck.name AS checker_name, u_ck.employee_code AS checker_empcode,
              COALESCE(ce.slm_rate_pre, ac.slm_rate_pre_2011) AS slm_rate_pre,
              COALESCE(ce.wdv_rate_post, ac.slm_rate_post_2011, ac.wdv_rate) AS wdv_rate_post,
              COALESCE(ce.depreciation_method, 'BOTH') AS depreciation_method,
              sl.rate AS article_rate, sl.stock_volume_no, sl.stock_page_no
       FROM condemnation_entry ce
       JOIN asset a ON a.id = ce.asset_id
       LEFT JOIN stock_ledger sl ON sl.id = a.stock_ledger_id
       JOIN asset_category ac ON ac.id = a.category_id
       JOIN department d ON d.id = ce.department_id
       JOIN funding_head fh ON fh.id = ce.funding_head_id
       JOIN vidyalaya v ON v.id = ce.vidyalaya_id
       LEFT JOIN depreciation_rule dr ON dr.id = a.depreciation_rule_id
       LEFT JOIN "user" u_si ON u_si.id = a.in_charge_id
       LEFT JOIN "user" u_ck ON u_ck.id = ce.checker_id
       WHERE ce.id = $1 AND ce.vidyalaya_id = $2`,
      [id, vid]
      );
      if (rows.length > 0) {
        const { rows: sanction } = await db.query(
          'SELECT * FROM sanction WHERE condemnation_id = $1 AND vidyalaya_id = $2', [id, vid]
        );
        const { rows: disposal } = await db.query(
          'SELECT * FROM disposal WHERE condemnation_id = $1 AND vidyalaya_id = $2', [id, vid]
        );
        return success(res, { ...rows[0], type: 'legacy', sanction: sanction[0] || null, disposal: disposal[0] || null });
      }
    }

    return error(res, 'Condemnation not found', 404);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/condemnations/:id/check  — certify (master-aware)
// ─────────────────────────────────────────────────────────────
router.put('/:id/check', authorize('StockHolder', 'Admin'),
  [body('cert_info_correct').isBoolean(), body('cert_normal_wear').isBoolean(), body('cert_board_report').isBoolean()],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const { cert_info_correct, cert_normal_wear, cert_board_report } = req.body;
      
      let rawId = req.params.id;
      let isLegacy = false;
      if (rawId.startsWith('legacy-')) { isLegacy = true; rawId = rawId.replace('legacy-', ''); }
      else if (rawId.startsWith('master-')) { rawId = rawId.replace('master-', ''); }
      const id = parseInt(rawId);

      if (!isLegacy) {
        const { rows: mRows } = await db.query(
          `UPDATE condemnation_master SET checker_id=$1, cert_info_correct=$2, cert_normal_wear=$3,
            cert_board_report=$4, updated_at=NOW()
           WHERE id=$5 AND vidyalaya_id=$6 RETURNING *`,
          [req.user.id, cert_info_correct, cert_normal_wear, cert_board_report, id, vid]
        );
        if (mRows.length > 0) return success(res, mRows[0]);
      }
      
      const { rows } = await db.query(
        `UPDATE condemnation_entry SET checker_id=$1, cert_info_correct=$2, cert_normal_wear=$3,
          cert_board_report=$4, updated_at=NOW()
         WHERE id=$5 AND vidyalaya_id=$6 RETURNING *`,
        [req.user.id, cert_info_correct, cert_normal_wear, cert_board_report, id, vid]
      );
      if (rows.length === 0) return error(res, 'Not found', 404);
      success(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/v1/condemnations/:id/board-review  (master-aware)
// ─────────────────────────────────────────────────────────────
router.post('/:id/board-review', authorize('Admin'),
  [body('board_date').isDate()], validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      let rawId = req.params.id;
      let isLegacy = false;
      if (rawId.startsWith('legacy-')) { isLegacy = true; rawId = rawId.replace('legacy-', ''); }
      else if (rawId.startsWith('master-')) { rawId = rawId.replace('master-', ''); }
      const id = parseInt(rawId);

      if (!isLegacy) {
        const { rows: mRows } = await db.query(
          `UPDATE condemnation_master SET status='BOARD_REVIEWED', board_date=$1, updated_at=NOW()
           WHERE id=$2 AND vidyalaya_id=$3 RETURNING *`,
          [req.body.board_date, id, vid]
        );
        if (mRows.length > 0) {
          await db.rawQuery(
            `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by)
             VALUES ('condemnation_master', $1, 'UPDATE', $2, $3)`,
            [mRows[0].id, JSON.stringify({ event: 'BOARD_REVIEWED', board_date: req.body.board_date }), req.user.id]
          );
          return success(res, mRows[0]);
        }
      }
      
      const { rows } = await db.query(
        `UPDATE condemnation_entry SET status='BOARD_REVIEWED', board_date=$1, updated_at=NOW()
         WHERE id=$2 AND vidyalaya_id=$3 RETURNING *`,
        [req.body.board_date, id, vid]
      );
      if (rows.length === 0) return error(res, 'Not found', 404);
      success(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /api/v1/condemnations/summary/report (unchanged)
// ─────────────────────────────────────────────────────────────
router.get('/summary/report', authorize('Admin'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { fy, fund_id } = req.query;
    let sql = `SELECT d.code AS department, COUNT(*) AS total_items,
                      SUM(ce.original_cost) AS total_cost,
                      SUM(ce.condemnation_cost) AS total_condemnation_cost
               FROM condemnation_entry ce
               JOIN department d ON d.id = ce.department_id
               WHERE ce.financial_year = $1 AND ce.vidyalaya_id = $2`;
    const params = [fy, vid];
    if (fund_id) { params.push(fund_id); sql += ` AND ce.funding_head_id = $${params.length}`; }
    sql += ' GROUP BY d.code ORDER BY d.code';
    const { rows } = await db.query(sql, params);
    success(res, rows);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/condemnations/:id/reject  — reject + revert assets
// ─────────────────────────────────────────────────────────────
router.post('/:id/reject', authorize('Admin'),
  [body('reason').notEmpty()], validate,
  async (req, res, next) => {
    const client = await db.getTenantClient();
    try {
      await client.query('BEGIN');
      const vid = req.user.vidyalaya_id;

      let rawId = req.params.id;
      let isLegacy = false;
      if (rawId.startsWith('legacy-')) { isLegacy = true; rawId = rawId.replace('legacy-', ''); }
      else if (rawId.startsWith('master-')) { rawId = rawId.replace('master-', ''); }
      const id = parseInt(rawId);

      if (!isLegacy) {
        const { rows: mRows } = await client.query(
          `UPDATE condemnation_master SET status = 'REJECTED', updated_at = NOW()
           WHERE id = $1 AND vidyalaya_id = $2 AND status IN ('PENDING','BOARD_REVIEWED')
           RETURNING *`,
          [id, vid]
        );

        if (mRows.length > 0) {
          // Revert all condemned assets back to ACTIVE
          await db.pool.query(
            `UPDATE asset SET status = 'ACTIVE', updated_at = NOW()
             WHERE id IN (
               SELECT asset_id FROM condemnation_items WHERE condemnation_master_id = $1
             ) AND status = 'UNDER_CONDEMNATION'`,
            [id]
          );
          await db.rawQuery(
            `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by)
             VALUES ('condemnation_master', $1, 'UPDATE', $2, $3)`,
            [mRows[0].id, JSON.stringify({ event: 'REJECTED', reason: req.body.reason }), req.user.id]
          );
          await client.query('COMMIT');
          return success(res, mRows[0]);
        }
      }

      // Legacy fallback
      const { rows } = await client.query(
        `UPDATE condemnation_entry SET status = 'REJECTED', updated_at = NOW()
         WHERE id = $1 AND vidyalaya_id = $2 AND status IN ('PENDING','BOARD_REVIEWED')
         RETURNING *`,
        [id, vid]
      );
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return error(res, 'Not found or not rejectable', 404);
      }
      // Revert legacy asset status
      await db.pool.query(
        `UPDATE asset SET status = 'ACTIVE', updated_at = NOW()
         WHERE id = $1 AND status = 'UNDER_CONDEMNATION'`,
        [rows[0].asset_id]
      );
      await client.query('COMMIT');
      success(res, rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

module.exports = router;

