const db = require('../config/db');
const { getContext } = require('../config/tenantContext');
const fyUtils = require('../utils/financialYear');

/**
 * Register balance computation.
 * Replaces ALL Excel FRONT DETAILS + department sheet formulas.
 */
class RegisterBalanceService {
  /**
   * Compute full GFR-22 register view for a department + funding head + FY.
   */
  async computeRegister(deptId, fundId, fy) {
    const ctx = getContext();
    const vid = ctx ? ctx.vidyalayaId : 1;
    const prevFy = fyUtils.previous(fy);

    // Opening = previous year's closing (or 0 if first year)
    const openingRes = await db.query(
      `SELECT COALESCE(SUM(total_cost), 0) AS opening
       FROM asset
       WHERE department_id = $1 AND funding_head_id = $2
         AND status IN ('ACTIVE', 'CONDEMNED', 'DISPOSED')
         AND purchase_date < $3 AND vidyalaya_id = $4`,
      [deptId, fundId, fyUtils.startDate(fy), vid]
    );

    // Opening snapshot check (for baseline mid-lifecycle adoption)
    const snapRes = await db.query(
      `SELECT opening_gross_value, opening_accum_depreciation
       FROM opening_balance_snapshot
       WHERE department_id = $1 AND funding_head_id = $2
         AND financial_year = $3 AND vidyalaya_id = $4`,
      [deptId, fundId, fy, vid]
    );
    const snapGross = snapRes.rows.length > 0 ? parseFloat(snapRes.rows[0].opening_gross_value) : 0;
    const snapDepr = snapRes.rows.length > 0 ? parseFloat(snapRes.rows[0].opening_accum_depreciation) : 0;

    const opening = Math.max(parseFloat(openingRes.rows[0].opening), snapGross);

    // Additions in current FY
    const addRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS additions
       FROM stock_ledger
       WHERE department_id = $1 AND funding_head_id = $2
         AND financial_year = $3 AND entry_type = 'RECEIPT'
         AND ledger_type = 'CS24' AND vidyalaya_id = $4`,
      [deptId, fundId, fy, vid]
    );
    const additions = parseFloat(addRes.rows[0].additions);

    // Condemnations in current FY (legacy + master)
    const condRes = await db.query(
      `SELECT COALESCE(SUM(original_cost), 0) AS condemned,
              COALESCE(SUM(total_depreciation), 0) AS condemned_depr
       FROM (
          SELECT original_cost, total_depreciation
          FROM condemnation_entry
          WHERE department_id = $1 AND funding_head_id = $2
            AND financial_year = $3 AND status IN ('SANCTIONED', 'DISPOSED') AND vidyalaya_id = $4
          UNION ALL
          SELECT ci.original_cost, ci.total_depreciation
          FROM condemnation_items ci
          JOIN condemnation_master cm ON cm.id = ci.condemnation_master_id
          WHERE ci.department_id = $1 AND cm.funding_head_id = $2
            AND cm.financial_year = $3 AND cm.status IN ('SANCTIONED', 'DISPOSED') AND cm.vidyalaya_id = $4
       ) sub`,
      [deptId, fundId, fy, vid]
    );
    const condemnations = parseFloat(condRes.rows[0].condemned);
    const condemnedDeprActual = parseFloat(condRes.rows[0].condemned_depr);

    // Closing = opening + additions - condemnations
    const closing = +(opening + additions - condemnations).toFixed(2);

    // Depreciation block
    const openDeprRes = await db.query(
      `SELECT COALESCE(SUM(dl.accum_depreciation), 0) AS open_depr
       FROM depreciation_ledger dl
       JOIN asset a ON a.id = dl.asset_id
       WHERE a.department_id = $1 AND a.funding_head_id = $2
         AND dl.financial_year = $3 AND dl.vidyalaya_id = $4`,
      [deptId, fundId, prevFy, vid]
    );
    const openDepr = Math.max(parseFloat(openDeprRes.rows[0].open_depr), snapDepr);

    const yearDeprRes = await db.query(
      `SELECT COALESCE(SUM(dl.depreciation_amount), 0) AS year_depr
       FROM depreciation_ledger dl
       JOIN asset a ON a.id = dl.asset_id
       WHERE a.department_id = $1 AND a.funding_head_id = $2
         AND dl.financial_year = $3 AND dl.vidyalaya_id = $4`,
      [deptId, fundId, fy, vid]
    );
    const yearDepr = parseFloat(yearDeprRes.rows[0].year_depr);

    // Condemned depreciation = actual total_depreciation at condemnation time (Phase 5)
    const condemnedDepr = condemnedDeprActual;

    // Closing depreciation
    const closingDepr = +(openDepr + yearDepr - condemnedDepr).toFixed(2);

    // Net block
    const netCurrent = +(closing - closingDepr).toFixed(2);
    const netPrevious = +(opening - openDepr).toFixed(2);

    return {
      financial_year: fy,
      department_id: deptId,
      funding_head_id: fundId,
      opening,
      additions,
      condemnations,
      closing,
      depreciation: {
        opening: openDepr,
        for_year: yearDepr,
        on_condemned: condemnedDepr,
        closing: closingDepr,
      },
      net_block: {
        current_year: netCurrent,
        previous_year: netPrevious,
      },
    };
  }
}

module.exports = new RegisterBalanceService();
