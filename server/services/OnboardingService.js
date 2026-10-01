const db = require('../config/db');
const { getContext } = require('../config/tenantContext');
const calcEngine = require('./DepreciationCalcEngine');
const assetNumberService = require('./AssetNumberService');
const fyUtils = require('../utils/financialYear');

/**
 * OnboardingService — Historical Asset Onboarding
 *
 * Handles the OPENING ENTRY flow for assets purchased before system adoption.
 * Atomically:
 *   1. Creates the stock ledger OPENING entry
 *   2. Creates the asset record with onboarding snapshot
 *   3. Auto-creates missing historical FY records (system-generated, hidden)
 *   4. Generates and inserts the full depreciation chain into the ledger
 *   5. Updates asset.book_value and accum_depreciation to the final state
 *
 * This service is decoupled from the UI — it can be called by:
 *   - The OPENING ENTRY form (single asset)
 *   - Future bulk import (CSV/Excel) services
 */
class OnboardingService {

  /**
   * Preview the onboarding result without persisting anything.
   * Returns the computed historical chain and final values.
   *
   * @param {Object} params - Asset details from the user form
   * @returns {Object} preview data
   */
  async preview(params) {
    const {
      purchase_date, total_cost, category_id,
    } = params;

    const ctx = getContext();
    const vid = ctx ? ctx.vidyalayaId : 1;

    // Look up category for WDV rate
    const { rows: catRows } = await db.query(
      'SELECT * FROM asset_category WHERE id = $1', [category_id]
    );
    if (catRows.length === 0) {
      throw Object.assign(new Error('Asset category not found'), { statusCode: 404 });
    }
    const cat = catRows[0];

    // Determine the adoption FY (current FY)
    const adoptionFY = fyUtils.current();
    const purchaseFY = fyUtils.fromDate(purchase_date);
    const isHistorical = purchaseFY < adoptionFY;

    if (!isHistorical) {
      // Not a historical asset — no onboarding preview needed
      return {
        is_historical: false,
        purchase_fy: purchaseFY,
        adoption_fy: adoptionFY,
        message: 'Asset is from the current or future FY. No historical depreciation will be generated.',
        entries: [],
        final_book_value: parseFloat(total_cost),
        final_accum_depreciation: 0,
      };
    }

    // Generate historical chain up to the FY before adoption
    const targetFY = calcEngine.getPreviousFY(adoptionFY);
    const chain = calcEngine.generateHistoricalChain(
      {
        total_cost: parseFloat(total_cost),
        purchase_date,
        wdv_rate: parseFloat(cat.wdv_rate),
        is_library: cat.is_library === true,
      },
      targetFY
    );

    return {
      is_historical: true,
      purchase_fy: purchaseFY,
      adoption_fy: adoptionFY,
      target_fy: targetFY,
      category_name: cat.name,
      wdv_rate: parseFloat(cat.wdv_rate),
      entries: chain.entries,
      entries_count: chain.entries.length,
      final_book_value: chain.finalBookValue,
      final_accum_depreciation: chain.finalAccumDepr,
      original_cost: parseFloat(total_cost),
    };
  }


  /**
   * Execute the full onboarding transaction.
   * Creates stock entry, asset, historical FYs, and depreciation ledger.
   *
   * @param {Object} params - All onboarding data
   * @param {number} userId - Authenticated user ID
   * @returns {Object} { asset, stock_entry, depreciation_entries_count }
   */
  async execute(params, userId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const ctx = getContext();
      const vid = ctx ? ctx.vidyalayaId : 1;

      const {
        // Stock entry fields
        operational_department_id, financial_year: entryFY,
        stock_volume_no, stock_page_no,
        // Asset fields
        name, description, category_id, funding_head_id,
        asset_head_id, purchase_date, total_units, unit_cost, total_cost,
        machine_no, accession_no, voucher_no, cheque_no,
        supplier_id, bill_no, bill_date, location_id,
        depreciation_rule_id, remarks,
      } = params;

      // ── 1. Look up category ───────────────────────────────
      const { rows: catRows } = await client.query(
        'SELECT * FROM asset_category WHERE id = $1', [category_id]
      );
      if (catRows.length === 0) {
        throw Object.assign(new Error('Asset category not found'), { statusCode: 404 });
      }
      const cat = catRows[0];

      // ── 2. Determine historical status ─────────────────────
      const adoptionFY = fyUtils.current();
      const purchaseFY = fyUtils.fromDate(purchase_date);
      const isHistorical = purchaseFY < adoptionFY;

      // ── 3. Create stock ledger OPENING entry ───────────────
      const stockFY = entryFY || purchaseFY;

      // Ensure the stock FY exists (may be historical)
      await calcEngine.ensureFYExists(client, stockFY);

      const { rows: stockRows } = await client.query(
        `INSERT INTO stock_ledger
         (ledger_type, entry_type, is_consumable, operational_department_id,
          funding_head_id, department_id,
          financial_year, stock_volume_no, stock_page_no, entry_date,
          item_description, machine_no, voucher_no, cheque_no,
          supplier_id, bill_no, bill_date,
          quantity, rate, amount, location_id,
          remarks, created_by, classification_status, vidyalaya_id)
         VALUES ('CS24', 'OPENING', false, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'CLASSIFIED', $21)
         RETURNING *`,
        [
          operational_department_id, funding_head_id, asset_head_id,
          stockFY, stock_volume_no || null, stock_page_no || null, purchase_date,
          name, machine_no || null, voucher_no || null, cheque_no || null,
          supplier_id || null, bill_no || null, bill_date || null,
          total_units, unit_cost, parseFloat(total_cost),
          location_id || null,
          `Opening Entry — Historical asset onboarded. ${remarks || ''}`.trim(),
          userId, vid,
        ]
      );
      const stockEntry = stockRows[0];

      // ── 4. Generate historical chain (if applicable) ───────
      let chain = { entries: [], finalBookValue: parseFloat(total_cost), finalAccumDepr: 0 };
      if (isHistorical) {
        const targetFY = calcEngine.getPreviousFY(adoptionFY);
        chain = calcEngine.generateHistoricalChain(
          {
            total_cost: parseFloat(total_cost),
            purchase_date,
            wdv_rate: parseFloat(cat.wdv_rate),
            is_library: cat.is_library === true,
          },
          targetFY
        );
      }

      // ── 5. Generate asset number & create asset ────────────
      const assetNumber = await assetNumberService.generate(asset_head_id, purchaseFY);

      const { rows: assetRows } = await client.query(
        `INSERT INTO asset
         (asset_number, stock_ledger_id, funding_head_id, department_id,
          operational_department_id, category_id,
          name, description, machine_no, accession_no, purchase_date,
          voucher_no, cheque_no, supplier_id, bill_no, bill_date,
          total_units, unit_cost, total_cost, location_id,
          depreciation_rule_id, remarks, created_by, vidyalaya_id,
          book_value, accum_depreciation,
          onboarding_fy, onboarding_generated_at,
          onboarding_opening_book_value, onboarding_accumulated_depreciation,
          onboarding_method_basis, onboarding_entry_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,NOW(),$28,$29,$30,$31)
         RETURNING *`,
        [
          assetNumber, stockEntry.id, funding_head_id, asset_head_id,
          operational_department_id, category_id,
          name, description || null, machine_no || null, accession_no || null, purchase_date,
          voucher_no || null, cheque_no || null, supplier_id || null, bill_no || null, bill_date || null,
          total_units, unit_cost, parseFloat(total_cost), location_id || null,
          depreciation_rule_id || null, remarks || null, userId, vid,
          chain.finalBookValue, chain.finalAccumDepr,
          isHistorical ? adoptionFY : null,
          chain.finalBookValue, chain.finalAccumDepr,
          'WDV', isHistorical ? 'OPENING_ONBOARDING' : null,
        ]
      );
      const asset = assetRows[0];

      // ── 6. Insert historical depreciation ledger entries ───
      let deprInserted = 0;
      if (isHistorical && chain.entries.length > 0) {
        for (const entry of chain.entries) {
          // Ensure each FY record exists
          await calcEngine.ensureFYExists(client, entry.financial_year);

          await client.query(
            `INSERT INTO depreciation_ledger
             (asset_id, financial_year, method, rate_applied,
              opening_value, depreciation_amount, closing_value, accum_depreciation,
              years_pre_2011, years_post_2011, depr_pre_2011, depr_post_2011,
              is_fully_depreciated, is_small_value_writeoff,
              computed_by, vidyalaya_id, entry_source, policy_version)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            [
              asset.id, entry.financial_year, entry.method, entry.rate_applied,
              entry.opening_value, entry.depreciation_amount, entry.closing_value, entry.accum_depreciation,
              0, 0, 0, 0,
              entry.is_fully_depreciated, entry.is_small_value_writeoff,
              userId, vid, 'OPENING_ONBOARDING', entry.policy_version,
            ]
          );
          deprInserted++;
        }
      }

      await client.query('COMMIT');

      return {
        asset: {
          id: asset.id,
          asset_number: asset.asset_number,
          name: asset.name,
          book_value: chain.finalBookValue,
          accum_depreciation: chain.finalAccumDepr,
          original_cost: parseFloat(total_cost),
        },
        stock_entry_id: stockEntry.id,
        is_historical: isHistorical,
        depreciation_entries_count: deprInserted,
        onboarding_fy: isHistorical ? adoptionFY : null,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Fetch aggregate opening balance snapshots for a given FY.
   */
  async getOpeningSnapshots(vidyalayaId, fy) {
    const { rows } = await db.query(
      `SELECT obs.*, d.code AS asset_head_code, d.name AS asset_head_name,
              fh.code AS funding_head_code, fh.name AS funding_head_name
       FROM opening_balance_snapshot obs
       JOIN department d ON d.id = obs.department_id
       JOIN funding_head fh ON fh.id = obs.funding_head_id
       WHERE obs.vidyalaya_id = $1 AND obs.financial_year = $2
       ORDER BY d.id, fh.id`,
      [vidyalayaId, fy]
    );
    return rows;
  }

  /**
   * Save or update opening balance snapshots for a given FY.
   */
  async saveOpeningSnapshots(vidyalayaId, fy, snapshots, userId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const item of snapshots) {
        const {
          department_id, funding_head_id,
          opening_gross_value = 0, opening_accum_depreciation = 0, remarks = null
        } = item;

        const gross = Math.max(0, parseFloat(opening_gross_value) || 0);
        const depr = Math.max(0, parseFloat(opening_accum_depreciation) || 0);
        if (depr > gross) {
          throw new Error(`Accumulated depreciation (₹${depr}) cannot exceed gross block (₹${gross})`);
        }

        const { rows } = await client.query(
          `INSERT INTO opening_balance_snapshot
           (vidyalaya_id, financial_year, department_id, funding_head_id,
            opening_gross_value, opening_accum_depreciation, remarks, created_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (vidyalaya_id, financial_year, department_id, funding_head_id)
           DO UPDATE SET
             opening_gross_value = EXCLUDED.opening_gross_value,
             opening_accum_depreciation = EXCLUDED.opening_accum_depreciation,
             remarks = EXCLUDED.remarks,
             updated_at = NOW()
           RETURNING *`,
          [vidyalayaId, fy, department_id, funding_head_id, gross, depr, remarks, userId]
        );
        results.push(rows[0]);
      }
      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Check opening balance setup status for a Vidyalaya.
   */
  async getSetupStatus(vidyalayaId, fy) {
    const adoptionFY = fy || fyUtils.current();

    const [snapRes, assetRes] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS count,
                COALESCE(SUM(opening_gross_value), 0) AS total_gross,
                COALESCE(SUM(opening_accum_depreciation), 0) AS total_depr
         FROM opening_balance_snapshot
         WHERE vidyalaya_id = $1 AND financial_year = $2`,
        [vidyalayaId, adoptionFY]
      ),
      db.query(
        `SELECT COUNT(*) AS count,
                COALESCE(SUM(total_cost), 0) AS total_cost
         FROM asset
         WHERE vidyalaya_id = $1 AND onboarding_entry_source = 'OPENING_ONBOARDING'`,
        [vidyalayaId]
      )
    ]);

    const snapCount = parseInt(snapRes.rows[0].count, 10);
    const snapGross = parseFloat(snapRes.rows[0].total_gross);
    const snapDepr = parseFloat(snapRes.rows[0].total_depr);
    const assetCount = parseInt(assetRes.rows[0].count, 10);
    const assetCost = parseFloat(assetRes.rows[0].total_cost);

    return {
      adoption_fy: adoptionFY,
      is_configured: snapCount > 0 || assetCount > 0,
      snapshot_count: snapCount,
      snapshot_gross: snapGross,
      snapshot_depr: snapDepr,
      onboarded_asset_count: assetCount,
      onboarded_asset_cost: assetCost,
    };
  }

  /**
   * Bulk onboard multiple assets from CSV/JSON.
   */
  async executeBulk(rows, userId) {
    const ctx = getContext();
    const vid = ctx ? ctx.vidyalayaId : 1;

    // Pre-load reference maps for code/name resolution
    const [catRes, fundRes, deptRes, opDeptRes] = await Promise.all([
      db.query('SELECT id, code, name FROM asset_category'),
      db.query('SELECT id, code, name FROM funding_head'),
      db.query('SELECT id, code, name FROM department'),
      db.query('SELECT id, name FROM operational_department WHERE vidyalaya_id = $1', [vid]),
    ]);

    const catMap = {};
    catRes.rows.forEach(c => {
      catMap[c.code.toUpperCase()] = c.id;
      catMap[c.name.toLowerCase()] = c.id;
      catMap[String(c.id)] = c.id;
    });

    const fundMap = {};
    fundRes.rows.forEach(f => {
      fundMap[f.code.toUpperCase()] = f.id;
      fundMap[f.name.toLowerCase()] = f.id;
      fundMap[String(f.id)] = f.id;
    });

    const deptMap = {};
    deptRes.rows.forEach(d => {
      deptMap[d.code.toUpperCase()] = d.id;
      deptMap[d.name.toLowerCase()] = d.id;
      deptMap[String(d.id)] = d.id;
    });

    const opDeptMap = {};
    opDeptRes.rows.forEach(od => {
      opDeptMap[od.name.toLowerCase()] = od.id;
      opDeptMap[String(od.id)] = od.id;
    });
    const defaultOpDeptId = opDeptRes.rows.length > 0 ? opDeptRes.rows[0].id : null;

    const succeeded = [];
    const failed = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      try {
        if (!row.name || !row.name.trim()) throw new Error('Asset name is required');
        if (!row.purchase_date) throw new Error('Purchase date is required');

        const totalCost = parseFloat(row.total_cost || row.cost || 0);
        if (isNaN(totalCost) || totalCost <= 0) throw new Error('Valid total cost (> 0) is required');

        const units = parseInt(row.total_units || row.quantity || 1, 10) || 1;
        const unitCost = row.unit_cost ? parseFloat(row.unit_cost) : (totalCost / units);

        // Resolve Category
        const catKey = String(row.category_id || row.category_code || row.category || 'OTHER').trim();
        const categoryId = catMap[catKey.toUpperCase()] || catMap[catKey.toLowerCase()] || catMap['OTHER'] || 1;

        // Resolve Funding Head
        const fundKey = String(row.funding_head_id || row.funding_head_code || row.fund || 'VVN').trim();
        const fundingHeadId = fundMap[fundKey.toUpperCase()] || fundMap[fundKey.toLowerCase()] || fundMap['VVN'] || 1;

        // Resolve Asset Head (Department)
        const deptKey = String(row.asset_head_id || row.asset_head_code || row.department || 'OFA').trim();
        const assetHeadId = deptMap[deptKey.toUpperCase()] || deptMap[deptKey.toLowerCase()] || deptMap['OFA'] || 1;

        // Resolve Operational Department
        const opKey = String(row.operational_department_id || row.operational_dept || '').trim();
        const operationalDeptId = opDeptMap[opKey.toLowerCase()] || opDeptMap[opKey] || defaultOpDeptId;

        const result = await this.execute({
          name: row.name.trim(),
          description: row.description || null,
          category_id: categoryId,
          funding_head_id: fundingHeadId,
          asset_head_id: assetHeadId,
          operational_department_id: operationalDeptId,
          purchase_date: row.purchase_date,
          total_units: units,
          unit_cost: unitCost,
          total_cost: totalCost,
          stock_volume_no: row.stock_volume_no ? parseInt(row.stock_volume_no, 10) : null,
          stock_page_no: row.stock_page_no ? parseInt(row.stock_page_no, 10) : null,
          machine_no: row.machine_no || null,
          accession_no: row.accession_no || null,
          voucher_no: row.voucher_no || null,
          cheque_no: row.cheque_no || null,
          bill_no: row.bill_no || null,
          bill_date: row.bill_date || null,
          remarks: row.remarks || null,
        }, userId);

        succeeded.push({ row: rowNum, asset_number: result.asset.asset_number, name: row.name });
      } catch (err) {
        failed.push({ row: rowNum, name: row.name || `Row ${rowNum}`, error: err.message });
      }
    }

    return {
      total: rows.length,
      succeeded_count: succeeded.length,
      failed_count: failed.length,
      succeeded,
      failed,
    };
  }
}

module.exports = new OnboardingService();

