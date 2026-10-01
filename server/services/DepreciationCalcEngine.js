const db = require('../config/db');
const { getContext } = require('../config/tenantContext');
const fyUtils = require('../utils/financialYear');

/**
 * DepreciationCalcEngine — Single Source of Truth
 *
 * Unified calculation engine used by:
 *   - DepreciationService   (annual live runs)
 *   - Onboarding flow       (historical auto-generation)
 *   - CondemnationCalcService (reads actual ledger)
 *   - DepreciationBreakdownModal (frontend detail view)
 *
 * Rules applied:
 *   - KVS Letter 08.12.2021: WDV depreciation, 95% cap, SVA 100%
 *   - Sequential FY enforcement for LIVE_RUN entries
 *   - Safe bypass for OPENING_ONBOARDING entries
 */

const DEFAULT_POLICY = 'KVS_2021_CIRCULAR';

class DepreciationCalcEngine {

  // ─── PURE CALCULATION ──────────────────────────────────────
  /**
   * Calculate depreciation for a single FY given known inputs.
   * Pure function — no DB access.
   *
   * @param {Object} params
   * @param {number} params.totalCost     - Original purchase cost
   * @param {number} params.openingValue  - Book value at FY start
   * @param {number} params.accumDepr     - Accumulated depreciation before this FY
   * @param {number} params.wdvRate       - WDV rate (e.g. 0.20 for 20%)
   * @param {boolean} params.isSmallValue - Is small value asset
   * @returns {Object} { amount, closingValue, newAccumDepr, isFullyDepreciated }
   */
  calculateForFY({ totalCost, openingValue, accumDepr, wdvRate, isSmallValue }) {
    let depr = 0;
    let isFullyDepreciated = false;

    if (isSmallValue) {
      depr = openingValue;
      isFullyDepreciated = true;
    } else {
      depr = Math.round(openingValue * wdvRate);

      // 95% cap (5% residual)
      const cap95 = Math.round(totalCost * 0.95);
      const maxAllowed = cap95 - accumDepr;

      if (depr > maxAllowed) {
        depr = Math.max(0, maxAllowed);
      }

      if (accumDepr + depr >= cap95) {
        isFullyDepreciated = true;
      }
    }

    return {
      amount: depr,
      closingValue: openingValue - depr,
      newAccumDepr: accumDepr + depr,
      isFullyDepreciated,
    };
  }


  // ─── HISTORICAL CHAIN GENERATOR ────────────────────────────
  /**
   * Generate FY-wise depreciation chain from purchase_date to target FY.
   * Used by onboarding and future bulk import.
   * Does NOT write to DB — returns an array of ledger row objects.
   *
   * @param {Object} asset - Must include: total_cost, purchase_date, wdv_rate, is_library, category_id
   * @param {string} targetFY - Last FY to generate for (e.g. '2025-26')
   * @returns {Object} { entries: Array, finalBookValue, finalAccumDepr }
   */
  generateHistoricalChain(asset, targetFY) {
    const totalCost = parseFloat(asset.total_cost);
    const wdvRate = parseFloat(asset.wdv_rate);
    const isLibrary = asset.is_library === true;
    const isSmallValue = totalCost <= 2000 && !isLibrary;

    const purchaseFY = fyUtils.fromDate(asset.purchase_date);
    const purchaseStart = parseInt(purchaseFY.split('-')[0], 10);
    const targetStart = parseInt(targetFY.split('-')[0], 10);

    const entries = [];
    let openingValue = totalCost;
    let accumDepr = 0;

    for (let year = purchaseStart; year <= targetStart; year++) {
      const fyCode = `${year}-${String(year + 1).slice(-2)}`;

      const calc = this.calculateForFY({
        totalCost,
        openingValue,
        accumDepr,
        wdvRate,
        isSmallValue,
      });

      if (calc.amount <= 0 && !calc.isFullyDepreciated) {
        // Nothing to depreciate, skip
        continue;
      }

      entries.push({
        financial_year: fyCode,
        method: isSmallValue ? 'WDV' : 'WDV',
        rate_applied: isSmallValue ? 1.0 : wdvRate,
        opening_value: openingValue,
        depreciation_amount: calc.amount,
        closing_value: calc.closingValue,
        accum_depreciation: calc.newAccumDepr,
        is_fully_depreciated: calc.isFullyDepreciated,
        is_small_value_writeoff: isSmallValue,
        entry_source: 'OPENING_ONBOARDING',
        policy_version: DEFAULT_POLICY,
      });

      openingValue = calc.closingValue;
      accumDepr = calc.newAccumDepr;

      // If fully depreciated, stop generating further entries
      if (calc.isFullyDepreciated) break;
    }

    return {
      entries,
      finalBookValue: openingValue,
      finalAccumDepr: accumDepr,
    };
  }


  // ─── FULL HISTORY FROM LEDGER ──────────────────────────────
  /**
   * Fetch the actual depreciation history from the ledger.
   * Used by the detail modal and condemnation module.
   *
   * @param {number} assetId
   * @returns {Object} { asset, ledgerEntries, summary }
   */
  async getFullHistory(assetId) {
    const ctx = getContext();
    const vid = ctx ? ctx.vidyalayaId : 1;

    const { rows: assetRows } = await db.query(
      `SELECT a.*, ac.wdv_rate, ac.is_library, ac.name AS category_name,
              ac.slm_rate_pre_2011, ac.slm_rate_post_2011,
              dr.life_years
       FROM asset a
       JOIN asset_category ac ON ac.id = a.category_id
       LEFT JOIN depreciation_rule dr ON dr.id = a.depreciation_rule_id
       WHERE a.id = $1 AND a.vidyalaya_id = $2`,
      [assetId, vid]
    );

    if (assetRows.length === 0) {
      throw Object.assign(new Error('Asset not found'), { statusCode: 404 });
    }
    const asset = assetRows[0];

    const { rows: ledgerEntries } = await db.query(
      `SELECT * FROM depreciation_ledger
       WHERE asset_id = $1 AND vidyalaya_id = $2
       ORDER BY financial_year ASC`,
      [assetId, vid]
    );

    // Build summary
    const totalDepr = ledgerEntries.reduce(
      (sum, e) => sum + parseFloat(e.depreciation_amount), 0
    );

    return {
      asset: {
        id: asset.id,
        asset_number: asset.asset_number,
        name: asset.name,
        purchase_date: asset.purchase_date,
        total_cost: parseFloat(asset.total_cost),
        book_value: parseFloat(asset.book_value),
        accum_depreciation: parseFloat(asset.accum_depreciation),
        category_name: asset.category_name,
        wdv_rate: parseFloat(asset.wdv_rate),
        is_small_value: asset.is_small_value,
        is_library: asset.is_library,
        onboarding_fy: asset.onboarding_fy,
      },
      ledgerEntries: ledgerEntries.map(e => ({
        financial_year: e.financial_year,
        method: e.method,
        rate_applied: parseFloat(e.rate_applied),
        opening_value: parseFloat(e.opening_value),
        depreciation_amount: parseFloat(e.depreciation_amount),
        closing_value: parseFloat(e.closing_value),
        accum_depreciation: parseFloat(e.accum_depreciation),
        is_fully_depreciated: e.is_fully_depreciated,
        is_small_value_writeoff: e.is_small_value_writeoff,
        entry_source: e.entry_source || 'LIVE_RUN',
        policy_version: e.policy_version || DEFAULT_POLICY,
        computed_at: e.computed_at,
      })),
      summary: {
        total_depreciation: totalDepr,
        entries_count: ledgerEntries.length,
        latest_fy: ledgerEntries.length > 0
          ? ledgerEntries[ledgerEntries.length - 1].financial_year
          : null,
      },
    };
  }


  // ─── MISSING FY DETECTION ─────────────────────────────────
  /**
   * Returns FYs that are missing from the ledger between purchase and target.
   *
   * @param {number} assetId
   * @param {string} targetFY
   * @returns {string[]} Array of missing FY codes
   */
  async getMissingFYs(assetId, targetFY) {
    const ctx = getContext();
    const vid = ctx ? ctx.vidyalayaId : 1;

    const { rows } = await db.query(
      `SELECT a.purchase_date FROM asset a WHERE a.id = $1 AND a.vidyalaya_id = $2`,
      [assetId, vid]
    );
    if (rows.length === 0) return [];

    const purchaseFY = fyUtils.fromDate(rows[0].purchase_date);
    const purchaseStart = parseInt(purchaseFY.split('-')[0], 10);
    const targetStart = parseInt(targetFY.split('-')[0], 10);

    // Get all existing FYs in ledger
    const { rows: existing } = await db.query(
      `SELECT financial_year FROM depreciation_ledger
       WHERE asset_id = $1 AND vidyalaya_id = $2`,
      [assetId, vid]
    );
    const existingSet = new Set(existing.map(r => r.financial_year));

    const missing = [];
    for (let year = purchaseStart; year <= targetStart; year++) {
      const fyCode = `${year}-${String(year + 1).slice(-2)}`;
      if (!existingSet.has(fyCode)) {
        missing.push(fyCode);
      }
    }
    return missing;
  }


  // ─── ENSURE FY EXISTS IN DB ────────────────────────────────
  /**
   * Auto-creates a financial_year record if it doesn't exist.
   * Tags it as system-generated so it stays hidden from user UI.
   *
   * @param {Object} client - DB client (for transaction use)
   * @param {string} fyCode - e.g. '2022-23'
   */
  async ensureFYExists(client, fyCode) {
    const startYear = parseInt(fyCode.split('-')[0], 10);
    const startDate = `${startYear}-04-01`;
    const endDate = `${startYear + 1}-03-31`;

    await client.query(
      `INSERT INTO financial_year (code, start_date, end_date, is_system_generated)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (code) DO NOTHING`,
      [fyCode, startDate, endDate]
    );
  }


  // ─── FY UTILITY ────────────────────────────────────────────

  /** Get the FY code a purchase date falls in */
  getFYFromDate(date) {
    return fyUtils.fromDate(date);
  }

  /** Get previous FY code */
  getPreviousFY(fy) {
    return fyUtils.previous(fy);
  }

  /** Get next FY code */
  getNextFY(fy) {
    const startYear = parseInt(fy.split('-')[0], 10);
    return `${startYear + 1}-${String(startYear + 2).slice(-2)}`;
  }
}

module.exports = new DepreciationCalcEngine();
