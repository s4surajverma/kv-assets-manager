const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const assetNumberService = require('../services/AssetNumberService');
const registerService = require('../services/RegisterBalanceService');
const calcEngine = require('../services/DepreciationCalcEngine');
const fyUtils = require('../utils/financialYear');
const { success, created, paginated, error } = require('../utils/responseHelper');

// POST /api/v1/assets
router.post(
  '/',
  authorize('StockHolder'),
  [
    body('stock_ledger_id').isInt(), body('name').notEmpty(),
    body('category_id').isInt(), body('funding_head_id').isInt(),
    body('asset_head_id').isInt(), body('operational_department_id').isInt(), body('purchase_date').isDate(),
    body('total_units').isInt({ min: 1 }),
    body('unit_cost').isFloat({ min: 0 }), body('total_cost').isFloat({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const b = req.body;
      const fy = fyUtils.fromDate(b.purchase_date);
      const assetNumber = await assetNumberService.generate(b.asset_head_id, fy);

      const { rows } = await db.query(
        `INSERT INTO asset
         (asset_number, stock_ledger_id, funding_head_id, department_id, operational_department_id, category_id,
          name, description, machine_no, accession_no, purchase_date,
          voucher_no, cheque_no, supplier_id, bill_no, bill_date,
          total_units, unit_cost, total_cost, location_id, in_charge_id,
          depreciation_rule_id, remarks, created_by, is_donation, vidyalaya_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
                 (SELECT is_donation FROM stock_ledger WHERE id = $2 AND vidyalaya_id = $25), $25)
         RETURNING *`,
        [
          assetNumber, b.stock_ledger_id, b.funding_head_id, b.asset_head_id, b.operational_department_id, b.category_id,
          b.name, b.description, b.machine_no, b.accession_no, b.purchase_date,
          b.voucher_no, b.cheque_no, b.supplier_id, b.bill_no, b.bill_date,
          b.total_units, b.unit_cost, b.total_cost, b.location_id, b.in_charge_id,
          b.depreciation_rule_id, b.remarks, req.user.id, vid
        ]
      );
      created(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// GET /api/v1/assets
router.get('/', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { status, asset_head_id, operational_dept_id, fund_id, category_id, page = 1, limit = 50 } = req.query;
    let sql = `SELECT a.*, d.code AS asset_head_code, od.name AS operational_dept_name, fh.code AS fund_code, ac.name AS category_name, ac.is_library
               FROM asset a
               JOIN department d ON d.id = a.department_id
               LEFT JOIN operational_department od ON od.id = a.operational_department_id
               JOIN funding_head fh ON fh.id = a.funding_head_id
               JOIN asset_category ac ON ac.id = a.category_id`;
    const params = [vid];
    const where = ['a.vidyalaya_id = $1'];

    if (status) { params.push(status); where.push(`a.status = $${params.length}`); }
    if (asset_head_id) { params.push(asset_head_id); where.push(`a.department_id = $${params.length}`); }
    if (operational_dept_id) { params.push(operational_dept_id); where.push(`a.operational_department_id = $${params.length}`); }
    if (fund_id) { params.push(fund_id); where.push(`a.funding_head_id = $${params.length}`); }
    if (category_id) { params.push(category_id); where.push(`a.category_id = $${params.length}`); }
    
    sql += ' WHERE ' + where.join(' AND ');

    const countSql = sql.replace(/SELECT [\s\S]*? FROM/i, 'SELECT COUNT(*) FROM');
    const { rows: c } = await db.query(countSql, params);
    const total = parseInt(c[0].count, 10);

    sql += ' ORDER BY a.purchase_date DESC, a.id DESC';
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await db.query(sql, params);
    paginated(res, rows, total, page, limit);
  } catch (err) { next(err); }
});

// GET /api/v1/assets/:id
router.get('/:id', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { rows: asset } = await db.query(
      `SELECT a.*, d.code AS asset_head_code, od.name AS operational_dept_name, fh.code AS fund_code, ac.name AS category_name
       FROM asset a
       JOIN department d ON d.id = a.department_id
       LEFT JOIN operational_department od ON od.id = a.operational_department_id
       JOIN funding_head fh ON fh.id = a.funding_head_id
       JOIN asset_category ac ON ac.id = a.category_id
       WHERE a.id = $1 AND a.vidyalaya_id = $2`, [req.params.id, vid]
    );
    if (asset.length === 0) return error(res, 'Asset not found', 404);

    const historyData = await calcEngine.getFullHistory(req.params.id);
    const deprHistory = historyData.ledgerEntries;
    const { rows: condemn } = await db.query(
      'SELECT * FROM condemnation_entry WHERE asset_id = $1 AND vidyalaya_id = $2', [req.params.id, vid]
    );

    success(res, { ...asset[0], depreciation_history: deprHistory, condemnation: condemn[0] || null });
  } catch (err) { next(err); }
});

// PUT /api/v1/assets/:id (location/custody only)
router.put('/:id', authorize('StockHolder'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { location_id, in_charge_id, remarks } = req.body;
    const { rows } = await db.query(
      `UPDATE asset SET location_id = COALESCE($1, location_id),
        in_charge_id = COALESCE($2, in_charge_id),
        remarks = COALESCE($3, remarks), updated_at = NOW()
       WHERE id = $4 AND vidyalaya_id = $5 RETURNING *`,
      [location_id, in_charge_id, remarks, req.params.id, vid]
    );
    if (rows.length === 0) return error(res, 'Asset not found', 404);
    success(res, rows[0]);
  } catch (err) { next(err); }
});

// GET /api/v1/assets/register/view — Financial summary (legacy, kept for compat)
router.get('/register/view', async (req, res, next) => {
  try {
    const { asset_head_id, fund_id, fy } = req.query;
    if (!asset_head_id || !fund_id || !fy) return error(res, 'asset_head_id, fund_id, fy required', 400);
    // registerService internally uses db.query, which picks up AsyncLocalStorage implicitly
    const data = await registerService.computeRegister(asset_head_id, fund_id, fy);
    success(res, data);
  } catch (err) { next(err); }
});

// GET /api/v1/assets/schedule4 — Official KVS Schedule 4 Statement
router.get('/schedule4/data', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { fund_id, fy } = req.query;
    if (!fund_id || !fy) return error(res, 'fund_id and fy are required', 400);

    const isAll = fund_id === 'all';
    const prevFy = fyUtils.previous(fy);
    const fyStart = fyUtils.startDate(fy);
    const fyEnd = fyUtils.endDate(fy);

    // Map department codes to schedule rows
    const DEPT_TO_ROW = {
      'COMP': 7, 'FURN': 3, 'LIB': 4, 'OFC_EQ': 5,
      'ADV': 10, 'LAB': 9, 'SPORT': 11, 'OFA': 12,
    };

    const { rows: departments } = await db.query('SELECT id, code FROM department');

    const fundIdx = isAll ? 0 : 1; // param index offset
    const vidPrm = isAll ? 2 : 3;

    // ---- GROSS BLOCK ----
    const { rows: openingRows } = await db.query(
      `SELECT a.department_id, COALESCE(SUM(a.total_cost), 0) AS val
       FROM asset a
       WHERE a.purchase_date < $1
         AND a.status IN ('ACTIVE','CONDEMNED','DISPOSED')
         ${isAll ? '' : `AND a.funding_head_id = $2`}
         AND a.vidyalaya_id = $${isAll ? 2 : 3}
       GROUP BY a.department_id`,
      isAll ? [fyStart, vid] : [fyStart, fund_id, vid]
    );

    const { rows: additionRows } = await db.query(
      `SELECT a.department_id, COALESCE(SUM(a.total_cost), 0) AS val
       FROM asset a
       WHERE a.purchase_date >= $1 AND a.purchase_date <= $2
         ${isAll ? '' : 'AND a.funding_head_id = $3'}
         AND a.vidyalaya_id = $${isAll ? 3 : 4}
       GROUP BY a.department_id`,
      isAll ? [fyStart, fyEnd, vid] : [fyStart, fyEnd, fund_id, vid]
    );

    const { rows: donationRows } = await db.query(
      `SELECT a.department_id, COALESCE(SUM(a.total_cost), 0) AS val
       FROM asset a
       WHERE a.purchase_date >= $1 AND a.purchase_date <= $2
         AND a.is_donation = true
         ${isAll ? '' : 'AND a.funding_head_id = $3'}
         AND a.vidyalaya_id = $${isAll ? 3 : 4}
       GROUP BY a.department_id`,
      isAll ? [fyStart, fyEnd, vid] : [fyStart, fyEnd, fund_id, vid]
    );

    const { rows: deductionRows } = await db.query(
      `SELECT department_id,
              COALESCE(SUM(original_cost), 0) AS val,
              COALESCE(SUM(total_depreciation), 0) AS depr_val,
              COALESCE(SUM(condemnation_cost), 0) AS loss_val
       FROM (
         SELECT ce.department_id, ce.original_cost, ce.total_depreciation, ce.condemnation_cost
         FROM condemnation_entry ce
         WHERE ce.financial_year = $1 AND ce.status IN ('SANCTIONED','DISPOSED')
           ${isAll ? '' : 'AND ce.funding_head_id = $2'}
           AND ce.vidyalaya_id = $${isAll ? 2 : 3}
         UNION ALL
         SELECT ci.department_id, ci.original_cost, ci.total_depreciation, ci.condemnation_cost
         FROM condemnation_items ci
         JOIN condemnation_master cm ON cm.id = ci.condemnation_master_id
         WHERE cm.financial_year = $1 AND cm.status IN ('SANCTIONED','DISPOSED')
           ${isAll ? '' : 'AND cm.funding_head_id = $2'}
           AND cm.vidyalaya_id = $${isAll ? 2 : 3}
       ) sub
       GROUP BY department_id`,
      isAll ? [fy, vid] : [fy, fund_id, vid]
    );

    // ---- DEPRECIATION BLOCK ----
    const { rows: openDeprRows } = await db.query(
      `SELECT a.department_id, COALESCE(SUM(dl.accum_depreciation), 0) AS val
       FROM depreciation_ledger dl
       JOIN asset a ON a.id = dl.asset_id
       WHERE dl.financial_year = $1
         ${isAll ? '' : 'AND a.funding_head_id = $2'}
         AND dl.vidyalaya_id = $${isAll ? 2 : 3}
       GROUP BY a.department_id`,
      isAll ? [prevFy, vid] : [prevFy, fund_id, vid]
    );

    const { rows: yearDeprRows } = await db.query(
      `SELECT a.department_id, COALESCE(SUM(dl.depreciation_amount), 0) AS val
       FROM depreciation_ledger dl
       JOIN asset a ON a.id = dl.asset_id
       WHERE dl.financial_year = $1
         ${isAll ? '' : 'AND a.funding_head_id = $2'}
         AND dl.vidyalaya_id = $${isAll ? 2 : 3}
       GROUP BY a.department_id`,
      isAll ? [fy, vid] : [fy, fund_id, vid]
    );

    // ---- OPENING BALANCE SNAPSHOT (Baseline carry-forward) ----
    const { rows: snapRows } = await db.query(
      `SELECT department_id,
              COALESCE(SUM(opening_gross_value), 0) AS snap_gross,
              COALESCE(SUM(opening_accum_depreciation), 0) AS snap_depr
       FROM opening_balance_snapshot
       WHERE financial_year = $1
         ${isAll ? '' : 'AND funding_head_id = $2'}
         AND vidyalaya_id = $${isAll ? 2 : 3}
       GROUP BY department_id`,
      isAll ? [fy, vid] : [fy, fund_id, vid]
    );

    const snapMap = {};
    for (const r of snapRows) {
      snapMap[r.department_id] = {
        gross: parseFloat(r.snap_gross || 0),
        depr: parseFloat(r.snap_depr || 0)
      };
    }

    // Helper: convert rows to dept_id -> value map
    const toMap = (rows) => {
      const m = {};
      for (const r of rows) m[r.department_id] = parseFloat(r.val);
      return m;
    };

    const openMap = toMap(openingRows);
    const addMap = toMap(additionRows);
    const donMap = toMap(donationRows);

    const toMapMulti = (rows) => {
      const m = {};
      for (const r of rows) m[r.department_id] = {
        val: parseFloat(r.val || 0),
        depr_val: parseFloat(r.depr_val || 0),
        loss_val: parseFloat(r.loss_val || 0)
      };
      return m;
    };
    const dedMultiMap = toMapMulti(deductionRows);
    const openDeprMap = toMap(openDeprRows);
    const yearDeprMap = toMap(yearDeprRows);

    // The 12 official asset head row labels
    const ROW_LABELS = [
      'Land', 'Building', 'Furniture, Fixtures', 'Library Books',
      'Office Equipments', 'Vehicles', 'Computer/Peripherals', 'Hostel Equipments',
      'Lab Equipments', 'Audio Visual & Musical Instruments', 'Sports Equipment', 'Other Fixed Assets',
    ];

    // Build the 12 rows
    const rowData = ROW_LABELS.map((label, i) => ({
      sn: i + 1, label,
      gb_opening: 0, gb_additions: 0, gb_deductions: 0, gb_closing: 0,
      donation_in_kind: 0,
      wo_gross: 0, wo_depr: 0, wo_loss: 0,
      depr_opening: 0, depr_additions: 0, depr_adjustments: 0, depr_total: 0,
      net_current: 0, net_previous: 0,
    }));

    // Distribute department values into the correct row
    for (const dept of departments) {
      const rowIdx = DEPT_TO_ROW[dept.code];
      if (!rowIdx) continue;
      const row = rowData[rowIdx - 1];

      const snapObj = snapMap[dept.id] || { gross: 0, depr: 0 };
      const op = Math.max(openMap[dept.id] || 0, snapObj.gross);
      const ad = addMap[dept.id] || 0;
      const don = donMap[dept.id] || 0;
      const dedObj = dedMultiMap[dept.id] || { val: 0, depr_val: 0, loss_val: 0 };
      const dd = dedObj.val;
      const d_depr = dedObj.depr_val;
      const d_loss = dedObj.loss_val;

      row.gb_opening += op;
      row.gb_additions += ad;
      row.donation_in_kind += don;
      row.gb_deductions += dd;
      row.gb_closing = +(row.gb_opening + row.gb_additions - row.gb_deductions).toFixed(2);

      // Assets Written Off breakdown
      row.wo_gross += dd;
      row.wo_depr += d_depr;
      row.wo_loss += d_loss;

      const dop = Math.max(openDeprMap[dept.id] || 0, snapObj.depr);
      const dyear = yearDeprMap[dept.id] || 0;
      const dadj = d_depr;

      row.depr_opening += dop;
      row.depr_additions += dyear;
      row.depr_adjustments += dadj;
      row.depr_total = +(row.depr_opening + row.depr_additions - row.depr_adjustments).toFixed(2);

      row.net_current = +(row.gb_closing - row.depr_total).toFixed(2);
      row.net_previous = +(row.gb_opening - row.depr_opening).toFixed(2);
    }

    // Round all values
    for (const r of rowData) {
      for (const k of Object.keys(r)) {
        if (typeof r[k] === 'number' && k !== 'sn') r[k] = +r[k].toFixed(2);
      }
    }

    // Compute TOTAL (A)
    const sumField = (field) => +rowData.reduce((s, r) => s + r[field], 0).toFixed(2);
    const totalA = {
      label: 'TOTAL (A)',
      gb_opening: sumField('gb_opening'), gb_additions: sumField('gb_additions'),
      gb_deductions: sumField('gb_deductions'), gb_closing: sumField('gb_closing'),
      donation_in_kind: sumField('donation_in_kind'), wo_gross: sumField('wo_gross'), wo_depr: sumField('wo_depr'), wo_loss: sumField('wo_loss'),
      depr_opening: sumField('depr_opening'), depr_additions: sumField('depr_additions'),
      depr_adjustments: sumField('depr_adjustments'), depr_total: sumField('depr_total'),
      net_current: sumField('net_current'), net_previous: sumField('net_previous'),
    };

    const zero = { gb_opening: 0, gb_additions: 0, gb_deductions: 0, gb_closing: 0, donation_in_kind: 0, wo_gross: 0, wo_depr: 0, wo_loss: 0, depr_opening: 0, depr_additions: 0, depr_adjustments: 0, depr_total: 0, net_current: 0, net_previous: 0 };
    const cwip = { label: 'Capital Work in Progress', ...zero };
    const intangible = { label: 'Computer Software etc. (C)', ...zero };

    const add2 = (a, b) => +(a + b).toFixed(2);
    const grandTotal = { label: 'GRAND TOTAL (A+B+C)' };
    for (const k of Object.keys(zero)) {
      grandTotal[k] = add2(add2(totalA[k], cwip[k]), intangible[k]);
    }

    // Fund info
    let fund = { code: 'ALL', name: 'All Funds Combined' };
    let scheduleLabel = '4';
    if (!isAll) {
      const { rows: fundRows } = await db.query('SELECT code, name FROM funding_head WHERE id = $1', [fund_id]);
      fund = fundRows[0] || fund;
      const FUND_SCHEDULE = { 'SF': '4(A)', 'VVN': '4(B)', 'CCA': '4(E)', 'PM_SHRI': '4(F)' };
      scheduleLabel = FUND_SCHEDULE[fund.code] || '4';
    }

    success(res, {
      schedule_label: scheduleLabel,
      fund_code: fund.code,
      fund_name: fund.name,
      financial_year: fy,
      fy_end_date: fyEnd.toISOString().split('T')[0],
      rows: rowData, totalA, cwip, intangible, grandTotal,
    });
  } catch (err) { next(err); }
});

// GET /api/v1/assets/aging
router.get('/aging/report', authorize('Admin', 'Principal'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const threshold = req.query.threshold_years || 0;
    const { rows } = await db.query(
      `SELECT a.*, d.code AS asset_head_code, dr.life_years,
              EXTRACT(YEAR FROM AGE(NOW(), a.purchase_date)) AS age_years
       FROM asset a
       JOIN department d ON d.id = a.department_id
       LEFT JOIN depreciation_rule dr ON dr.id = a.depreciation_rule_id
       WHERE a.status = 'ACTIVE' AND a.vidyalaya_id = $1
         AND EXTRACT(YEAR FROM AGE(NOW(), a.purchase_date)) >= COALESCE(dr.life_years, $2)
       ORDER BY age_years DESC`,
      [vid, threshold]
    );
    success(res, rows);
  } catch (err) { next(err); }
});

// GET /api/v1/assets/small-value
router.get('/small-value/list', authorize('Admin'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { rows } = await db.query(
      `SELECT a.*, d.code AS asset_head_code FROM asset a
       JOIN department d ON d.id = a.department_id
       WHERE a.is_small_value = true AND a.vidyalaya_id = $1 ORDER BY a.purchase_date DESC`, [vid]
    );
    success(res, rows);
  } catch (err) { next(err); }
});

// GET /api/v1/assets/gfr22 — TRUE GFR-22 Register of Fixed Assets
router.get('/gfr22/register', async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { asset_head_id, operational_dept_id, fund_id, fy, in_charge_id } = req.query;
    let sql = `SELECT a.*, 
                      d.code AS asset_head_code, d.name AS asset_head_name,
                      od.name AS operational_dept_name,
                      fh.code AS fund_code,
                      s.name AS supplier_name, s.address AS supplier_address,
                      l.name AS location_name, l.building, l.room_number,
                      ac.name AS category_name,
                      sl.remarks AS stock_remarks
               FROM asset a
               JOIN department d ON d.id = a.department_id
               LEFT JOIN operational_department od ON od.id = a.operational_department_id
               JOIN funding_head fh ON fh.id = a.funding_head_id
               JOIN asset_category ac ON ac.id = a.category_id
               LEFT JOIN supplier s ON s.id = a.supplier_id
               LEFT JOIN location l ON l.id = a.location_id
               LEFT JOIN stock_ledger sl ON sl.id = a.stock_ledger_id`;
    const params = [vid];
    const where = ['a.vidyalaya_id = $1'];

    if (asset_head_id) { params.push(asset_head_id); where.push(`a.department_id = $${params.length}`); }
    if (operational_dept_id) { params.push(operational_dept_id); where.push(`a.operational_department_id = $${params.length}`); }
    if (fund_id) { params.push(fund_id); where.push(`a.funding_head_id = $${params.length}`); }
    if (in_charge_id) { params.push(in_charge_id); where.push(`a.in_charge_id = $${params.length}`); }
    if (fy) {
      params.push(fy + '%');
      where.push(`a.asset_number ILIKE '%' || $${params.length}`);
    }
    
    sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY a.purchase_date ASC, a.id ASC';

    const { rows } = await db.query(sql, params);

    const grouped = {};
    for (const row of rows) {
      const key = `${row.fund_code}|${row.category_name}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }

    success(res, { entries: rows, grouped });
  } catch (err) { next(err); }
});

module.exports = router;
