const db = require('../config/db');
const { getContext } = require('../config/tenantContext');
const calcEngine = require('./DepreciationCalcEngine');

const DEFAULT_POLICY = 'KVS_2021_CIRCULAR';

/**
 * DepreciationService — Annual depreciation orchestrator.
 *
 * Delegates all math to DepreciationCalcEngine.
 * Handles DB transactions, sequential FY validation, and asset updates.
 */
class DepreciationService {

  /**
   * Run annual depreciation for all active assets in a financial year.
   * Enforces sequential FY order (cannot run 2026-27 without 2025-26 being done).
   */
  async runAnnualDepreciation(financialYear, userId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // ── 1. FY validation ───────────────────────────────────
      const fyCheck = await client.query(
        'SELECT is_closed, depreciation_run FROM financial_year WHERE code = $1',
        [financialYear]
      );
      if (fyCheck.rows.length === 0) {
        throw Object.assign(new Error('Financial year not found'), { statusCode: 404 });
      }
      if (fyCheck.rows[0].is_closed) {
        throw Object.assign(new Error('Financial year is closed'), { statusCode: 400 });
      }
      if (fyCheck.rows[0].depreciation_run) {
        throw Object.assign(new Error('Depreciation already run for this FY'), { statusCode: 400 });
      }

      // ── 2. Sequential FY enforcement ───────────────────────
      const prevFY = calcEngine.getPreviousFY(financialYear);
      const prevCheck = await client.query(
        'SELECT depreciation_run FROM financial_year WHERE code = $1',
        [prevFY]
      );
      // If previous FY exists in DB, it must have depreciation_run = true
      // Exception: if it's the very first FY in the system (prevCheck returns 0 rows)
      if (prevCheck.rows.length > 0 && !prevCheck.rows[0].depreciation_run) {
        throw Object.assign(
          new Error(`Sequential violation: depreciation for FY ${prevFY} must be run first`),
          { statusCode: 400 }
        );
      }

      const ctx = getContext();
      const vid = ctx ? ctx.vidyalayaId : 1;

      // ── 3. Fetch eligible assets ───────────────────────────
      // Only depreciate assets that:
      //   a) Are ACTIVE
      //   b) Were purchased BEFORE or DURING this FY
      //   c) Belong to this tenant
      const fyStartDate = `${financialYear.split('-')[0]}-04-01`;
      const fyEndDate = `${parseInt(financialYear.split('-')[0]) + 1}-03-31`;

      const { rows: assets } = await client.query(
        `SELECT a.*, ac.wdv_rate, ac.is_library
         FROM asset a
         JOIN asset_category ac ON ac.id = a.category_id
         WHERE a.status = 'ACTIVE'
           AND a.vidyalaya_id = $1
           AND a.purchase_date <= $2`,
        [vid, fyEndDate]
      );

      let processed = 0;
      let totalDepr = 0;
      let fullyDepreciated = 0;

      for (const asset of assets) {
        const totalCost = parseFloat(asset.total_cost);
        const isLibrary = asset.is_library === true;
        const isSmallValue = totalCost <= 2000 && !isLibrary;

        const calc = calcEngine.calculateForFY({
          totalCost,
          openingValue: parseFloat(asset.book_value),
          accumDepr: parseFloat(asset.accum_depreciation),
          wdvRate: parseFloat(asset.wdv_rate),
          isSmallValue,
        });

        if (calc.amount <= 0) continue;

        // ── Insert ledger entry with provenance ────────────
        await client.query(
          `INSERT INTO depreciation_ledger
           (asset_id, financial_year, method, rate_applied,
            opening_value, depreciation_amount, closing_value, accum_depreciation,
            years_pre_2011, years_post_2011, depr_pre_2011, depr_post_2011,
            is_fully_depreciated, is_small_value_writeoff,
            computed_by, vidyalaya_id, entry_source, policy_version)
           VALUES ($1,$2,'WDV',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [
            asset.id, financialYear,
            isSmallValue ? 1.0 : asset.wdv_rate,
            asset.book_value, calc.amount, calc.closingValue, calc.newAccumDepr,
            0, 0, 0, 0,
            calc.isFullyDepreciated, isSmallValue,
            userId, vid, 'LIVE_RUN', DEFAULT_POLICY,
          ]
        );

        // ── Update asset book value ────────────────────────
        await client.query(
          'UPDATE asset SET book_value = $1, accum_depreciation = $2, updated_at = NOW() WHERE id = $3 AND vidyalaya_id = $4',
          [calc.closingValue, calc.newAccumDepr, asset.id, vid]
        );

        processed++;
        totalDepr += calc.amount;
        if (calc.isFullyDepreciated) fullyDepreciated++;
      }

      // ── 4. Mark FY depreciation as done ────────────────────
      await client.query(
        'UPDATE financial_year SET depreciation_run = true, depreciation_run_at = NOW() WHERE code = $1',
        [financialYear]
      );

      await client.query('COMMIT');
      return { processed, totalDepr, fullyDepreciated };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Preview depreciation without applying (dry run).
   * Also reports whether the FY has sequential gaps.
   */
  async previewDepreciation(financialYear) {
    const ctx = getContext();
    const vid = ctx ? ctx.vidyalayaId : 1;

    // Check sequential status
    const prevFY = calcEngine.getPreviousFY(financialYear);
    const prevCheck = await db.query(
      'SELECT depreciation_run FROM financial_year WHERE code = $1',
      [prevFY]
    );
    const sequentialWarning = (prevCheck.rows.length > 0 && !prevCheck.rows[0].depreciation_run)
      ? `Warning: Depreciation for FY ${prevFY} has not been run yet.`
      : null;

    const fyEndDate = `${parseInt(financialYear.split('-')[0]) + 1}-03-31`;

    const { rows: assets } = await db.query(
      `SELECT a.*, ac.wdv_rate, ac.is_library
       FROM asset a
       JOIN asset_category ac ON ac.id = a.category_id
       WHERE a.status = 'ACTIVE'
         AND a.vidyalaya_id = $1
         AND a.purchase_date <= $2`,
      [vid, fyEndDate]
    );

    const preview = [];
    for (const asset of assets) {
      const totalCost = parseFloat(asset.total_cost);
      const isLibrary = asset.is_library === true;
      const isSmallValue = totalCost <= 2000 && !isLibrary;

      const calc = calcEngine.calculateForFY({
        totalCost,
        openingValue: parseFloat(asset.book_value),
        accumDepr: parseFloat(asset.accum_depreciation),
        wdvRate: parseFloat(asset.wdv_rate),
        isSmallValue,
      });

      if (calc.amount <= 0 && !calc.isFullyDepreciated) continue;

      preview.push({
        asset_id: asset.id,
        asset_number: asset.asset_number,
        name: asset.name,
        current_book_value: parseFloat(asset.book_value),
        depreciation_amount: calc.amount,
        new_book_value: calc.closingValue,
        is_fully_depreciated: calc.isFullyDepreciated,
      });
    }

    return {
      financial_year: financialYear,
      sequential_warning: sequentialWarning,
      assets: preview,
    };
  }
}

module.exports = new DepreciationService();
