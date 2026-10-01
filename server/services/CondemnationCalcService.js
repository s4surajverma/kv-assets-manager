const db = require('../config/db');
const { getContext } = require('../config/tenantContext');
const fyUtils = require('../utils/financialYear');

const DEFAULT_POLICY = 'KVS_2021_CIRCULAR';

/**
 * CondemnationCalcService — Ledger-Driven Condemnation Computation
 *
 * PHASE 4 REFACTOR: Now reads actual depreciation from depreciation_ledger
 * (Single Source of Truth) instead of re-calculating from scratch.
 *
 * Fallback: For assets with no ledger entries (pre-system historical records),
 * the service falls back to theoretical WDV calculation for backward compatibility.
 * Legacy records are clearly flagged as 'THEORETICAL' in the response.
 */
class CondemnationCalcService {

  /**
   * Check if an asset has pending (unrun) depreciation for the current FY.
   * Condemnation is blocked if current FY depreciation has not been run.
   *
   * @param {number} assetId
   * @param {number} vid - vidyalaya_id
   * @returns {Object} { hasPending: boolean, pendingFY: string|null, message: string|null }
   */
  async pendingDepreciationCheck(assetId, vid) {
    const currentFY = fyUtils.current();

    // Get asset purchase date
    const { rows: assetRows } = await db.query(
      'SELECT purchase_date, is_small_value FROM asset WHERE id = $1 AND vidyalaya_id = $2',
      [assetId, vid]
    );
    if (assetRows.length === 0) return { hasPending: false };

    const asset = assetRows[0];
    const purchaseFY = fyUtils.fromDate(asset.purchase_date);

    // Small value assets are 100% depreciated on purchase — no pending check needed
    if (asset.is_small_value) return { hasPending: false };

    // If asset was purchased in the current FY, no previous depreciation required
    if (purchaseFY >= currentFY) return { hasPending: false };

    // Check if current FY depreciation exists in the ledger
    const { rows: ledgerRows } = await db.query(
      'SELECT id FROM depreciation_ledger WHERE asset_id = $1 AND vidyalaya_id = $2 AND financial_year = $3',
      [assetId, vid, currentFY]
    );

    // Check if current FY depreciation_run is complete (meaning the annual run happened)
    const { rows: fyRows } = await db.query(
      'SELECT depreciation_run FROM financial_year WHERE code = $1',
      [currentFY]
    );

    const fyRunComplete = fyRows.length > 0 && fyRows[0].depreciation_run === true;
    const assetHasCurrentFYEntry = ledgerRows.length > 0;

    // If FY run is complete but this asset has no entry, it's been fully depreciated or excluded — allow
    // If FY run is NOT complete, the annual run hasn't happened yet — allow (no blocking)
    // Only block if: FY run is complete AND this asset is missing its entry (shouldn't normally happen)
    if (fyRunComplete && !assetHasCurrentFYEntry) {
      return {
        hasPending: true,
        pendingFY: currentFY,
        message: `Depreciation for FY ${currentFY} has been run system-wide but this asset has no ledger entry. Please verify before condemning.`,
      };
    }

    return { hasPending: false };
  }

  /**
   * Compute condemnation financials for a single asset.
   * PRIMARY: Reads from depreciation_ledger (actual, audit-safe).
   * FALLBACK: Theoretical WDV if no ledger entries found.
   *
   * @param {number} assetId
   * @param {string} method - 'BOTH' | 'SLM_PRE_2011' | 'WDV_POST_2011' (legacy compat)
   * @returns {Object} Full computation result with immutable snapshot fields
   */
  async compute(assetId, method = 'BOTH') {
    const ctx = getContext();
    const vid = ctx ? ctx.vidyalayaId : 1;

    // ── Fetch asset with category ─────────────────────────
    const { rows } = await db.query(
      `SELECT a.*, ac.wdv_rate, ac.slm_rate_pre_2011, ac.slm_rate_post_2011,
              ac.is_library, ac.name AS category_name, dr.life_years
       FROM asset a
       JOIN asset_category ac ON ac.id = a.category_id
       LEFT JOIN depreciation_rule dr ON dr.id = a.depreciation_rule_id
       WHERE a.id = $1 AND a.vidyalaya_id = $2`,
      [assetId, vid]
    );

    if (rows.length === 0) {
      throw Object.assign(new Error('Asset not found'), { statusCode: 404 });
    }

    const asset = rows[0];
    if (asset.status !== 'ACTIVE') {
      throw Object.assign(new Error(`Asset is ${asset.status}, cannot condemn`), { statusCode: 400 });
    }

    const cost = parseFloat(asset.total_cost);
    const isLibrary = asset.is_library === true;
    const isSmallValue = cost <= 2000 && !isLibrary;
    const cap95 = Math.round(cost * 0.95);

    // ── Read actual ledger entries ─────────────────────────
    const { rows: ledgerEntries } = await db.query(
      `SELECT * FROM depreciation_ledger
       WHERE asset_id = $1 AND vidyalaya_id = $2
       ORDER BY financial_year ASC`,
      [assetId, vid]
    );

    const hasLedger = ledgerEntries.length > 0;
    let totalDepr, condemnationCost, bookValue, yearlyBreakdown;
    let deprPre = 0, deprPost = 0, yearsPre = 0, yearsPost = 0;
    let computationMode;

    if (hasLedger) {
      // ── LEDGER-DRIVEN (authoritative) ────────────────────
      computationMode = 'LEDGER';

      // Use the last ledger entry for final values
      const lastEntry = ledgerEntries[ledgerEntries.length - 1];
      bookValue = parseFloat(lastEntry.closing_value);
      totalDepr = parseFloat(asset.accum_depreciation); // authoritative from asset table
      condemnationCost = Math.max(0, bookValue);

      // Build yearly breakdown from actual ledger
      yearlyBreakdown = ledgerEntries.map(e => {
        const purchaseFY = fyUtils.fromDate(asset.purchase_date);
        const purchaseStartYear = parseInt(purchaseFY.split('-')[0], 10);
        const entryStartYear = parseInt(e.financial_year.split('-')[0], 10);
        const isPre2011 = entryStartYear < 2011;

        if (isPre2011) {
          deprPre += parseFloat(e.depreciation_amount);
          yearsPre++;
        } else {
          deprPost += parseFloat(e.depreciation_amount);
          yearsPost++;
        }

        return {
          fy_label: e.financial_year,
          fy_start_year: entryStartYear,
          method_used: e.method,
          rate_applied: parseFloat(e.rate_applied),
          opening_value: parseFloat(e.opening_value),
          depreciation: parseFloat(e.depreciation_amount),
          closing_value: parseFloat(e.closing_value),
          formula: `₹${parseFloat(e.opening_value).toLocaleString('en-IN')} × ${(parseFloat(e.rate_applied) * 100).toFixed(1)}% = ₹${parseFloat(e.depreciation_amount).toLocaleString('en-IN')}`,
          entry_source: e.entry_source || 'LIVE_RUN',
          policy_version: e.policy_version || DEFAULT_POLICY,
          note: e.is_fully_depreciated ? '95% cap reached — residual 5% preserved' : undefined,
        };
      });
    } else {
      // ── THEORETICAL FALLBACK (pre-system assets) ─────────
      // Use the existing theoretical calculation logic for backward compatibility.
      computationMode = 'THEORETICAL';
      const result = this._computeTheoretical(asset, cost, isSmallValue, method);
      totalDepr = result.totalDepr;
      condemnationCost = result.condemnationCost;
      bookValue = condemnationCost;
      yearlyBreakdown = result.yearlyBreakdown;
      deprPre = result.deprPre;
      deprPost = result.deprPost;
      yearsPre = result.yearsPre;
      yearsPost = result.yearsPost;
    }

    return {
      // Asset identity
      asset_id: asset.id,
      asset_number: asset.asset_number,
      name: asset.name,
      purchase_date: asset.purchase_date,
      category_name: asset.category_name,
      is_small_value: isSmallValue,
      life_period_years: asset.life_years || null,

      // Financial snapshot (immutable at condemnation time)
      original_cost: cost,
      total_depreciation: totalDepr,
      cap_95: cap95,
      condemnation_cost: condemnationCost,
      depreciated_value: totalDepr,
      book_value_at_condemnation: bookValue,

      // Method & policy provenance
      depreciation_method: method,
      computation_mode: computationMode,
      policy_version: DEFAULT_POLICY,

      // Pre/Post 2011 breakdown (for legacy reports)
      slm_rate_pre: parseFloat(asset.slm_rate_pre_2011 || 0),
      wdv_rate_post: parseFloat(asset.slm_rate_post_2011 || asset.wdv_rate),
      years_pre_2011: yearsPre,
      years_post_2011: yearsPost,
      depr_pre_2011: deprPre,
      depr_post_2011: deprPost,

      // Year-by-year breakdown
      yearly_breakdown: yearlyBreakdown,
    };
  }

  /**
   * Theoretical fallback — used when no ledger entries exist.
   * Preserves the original CondemnationCalcService logic exactly.
   * @private
   */
  _computeTheoretical(asset, cost, isSmallValue, method) {
    const slmPre = parseFloat(asset.slm_rate_pre_2011 || 0);
    const wdvPost = parseFloat(asset.slm_rate_post_2011 || asset.wdv_rate);

    const purchaseDate = new Date(asset.purchase_date);
    const today = new Date();
    const purchaseFy = this._getFyStartYear(purchaseDate);
    const currentFy = this._getFyStartYear(today);

    let yearsPre = 0, yearsPost = 0;
    if (purchaseFy <= 2010) {
      yearsPre = Math.min(currentFy, 2010) - purchaseFy + 1;
      if (currentFy >= 2011) yearsPost = currentFy - 2011 + 1;
    } else {
      yearsPost = currentFy - purchaseFy + 1;
    }

    let deprPre = 0, deprPost = 0, totalDepr = 0;
    const cap95 = Math.round(cost * 0.95);
    const yearlyBreakdown = [];

    if (isSmallValue) {
      totalDepr = cost;
      deprPost = cost;
      yearlyBreakdown.push({
        fy_label: `${purchaseFy}-${String(purchaseFy + 1).slice(-2)}`,
        fy_start_year: purchaseFy,
        method_used: 'SVA 100%',
        rate_applied: 1.0,
        opening_value: cost,
        depreciation: cost,
        closing_value: 0,
        formula: `₹${cost.toLocaleString('en-IN')} × 100% (Small Value Asset)`,
        note: 'THEORETICAL',
      });
    } else {
      let currentValue = cost;
      const totalYears = yearsPre + yearsPost;
      const startFy = purchaseFy;

      if (method === 'SLM_PRE_2011') {
        for (let i = 0; i < totalYears; i++) {
          const fyStart = startFy + i;
          const yearlyDepr = Math.round(cost * slmPre);
          const opening = currentValue;
          currentValue -= yearlyDepr;
          deprPre += yearlyDepr;
          yearlyBreakdown.push({
            fy_label: `${fyStart}-${String(fyStart + 1).slice(-2)}`,
            fy_start_year: fyStart,
            method_used: 'SLM',
            rate_applied: slmPre,
            opening_value: opening,
            depreciation: yearlyDepr,
            closing_value: currentValue,
            formula: `₹${cost.toLocaleString('en-IN')} × ${(slmPre * 100).toFixed(1)}%`,
            note: 'THEORETICAL',
          });
        }
        yearsPre = totalYears; yearsPost = 0;
      } else if (method === 'WDV_POST_2011') {
        for (let i = 0; i < totalYears; i++) {
          const fyStart = startFy + i;
          const opening = currentValue;
          const yearlyDepr = Math.round(currentValue * wdvPost);
          deprPost += yearlyDepr;
          currentValue -= yearlyDepr;
          yearlyBreakdown.push({
            fy_label: `${fyStart}-${String(fyStart + 1).slice(-2)}`,
            fy_start_year: fyStart,
            method_used: 'WDV',
            rate_applied: wdvPost,
            opening_value: opening,
            depreciation: yearlyDepr,
            closing_value: currentValue,
            formula: `₹${opening.toLocaleString('en-IN')} × ${(wdvPost * 100).toFixed(1)}%`,
            note: 'THEORETICAL',
          });
        }
        yearsPost = totalYears; yearsPre = 0;
      } else {
        // BOTH: SLM pre-2011, then WDV post-2011
        const slmPerYear = Math.round(cost * slmPre);
        for (let i = 0; i < yearsPre; i++) {
          const fyStart = purchaseFy + i;
          const opening = currentValue;
          currentValue -= slmPerYear;
          deprPre += slmPerYear;
          yearlyBreakdown.push({
            fy_label: `${fyStart}-${String(fyStart + 1).slice(-2)}`,
            fy_start_year: fyStart,
            method_used: 'SLM',
            rate_applied: slmPre,
            opening_value: opening,
            depreciation: slmPerYear,
            closing_value: currentValue,
            formula: `₹${cost.toLocaleString('en-IN')} × ${(slmPre * 100).toFixed(1)}%`,
            note: 'THEORETICAL',
          });
        }
        currentValue = cost - deprPre;
        for (let i = 0; i < yearsPost; i++) {
          if (currentValue <= 0) break;
          const fyStart = 2011 + i;
          const opening = currentValue;
          const yearlyDepr = Math.round(currentValue * wdvPost);
          deprPost += yearlyDepr;
          currentValue -= yearlyDepr;
          yearlyBreakdown.push({
            fy_label: `${fyStart}-${String(fyStart + 1).slice(-2)}`,
            fy_start_year: fyStart,
            method_used: 'WDV',
            rate_applied: wdvPost,
            opening_value: opening,
            depreciation: yearlyDepr,
            closing_value: currentValue,
            formula: `₹${opening.toLocaleString('en-IN')} × ${(wdvPost * 100).toFixed(1)}%`,
            note: 'THEORETICAL',
          });
        }
      }

      totalDepr = deprPre + deprPost;
      if (totalDepr > cap95) {
        totalDepr = cap95;
        if (deprPre > cap95) { deprPre = cap95; deprPost = 0; }
        else { deprPost = cap95 - deprPre; }
        if (yearlyBreakdown.length > 0) {
          yearlyBreakdown[yearlyBreakdown.length - 1].note = 'THEORETICAL — 95% cap applied';
        }
      }
    }

    return {
      totalDepr,
      condemnationCost: Math.max(0, cost - totalDepr),
      yearlyBreakdown,
      deprPre, deprPost, yearsPre, yearsPost,
    };
  }

  _getFyStartYear(date) {
    const d = new Date(date);
    const m = d.getMonth();
    const y = d.getFullYear();
    return m >= 3 ? y : y - 1;
  }
}

module.exports = new CondemnationCalcService();
