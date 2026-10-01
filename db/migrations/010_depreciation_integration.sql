-- ============================================================
-- 010: Depreciation / Condemnation / Schedule 4 — Unified Integration
-- ============================================================
-- Phase 1: Database Foundation
--
-- Changes:
--   1. depreciation_ledger  — adds entry_source, policy_version
--   2. asset                — adds onboarding snapshot fields
--   3. financial_year       — adds is_system_generated flag
--   4. condemnation_items   — adds immutable snapshot fields
--   5. NEW TRIGGER          — sequential depreciation enforcement
--   6. MODIFIED TRIGGER     — FY lock bypass for OPENING_ONBOARDING
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. DEPRECIATION LEDGER — Entry provenance & policy versioning
-- ────────────────────────────────────────────────────────────

-- 1a. entry_source: explicit accounting provenance
ALTER TABLE depreciation_ledger
  ADD COLUMN IF NOT EXISTS entry_source VARCHAR(20)
    DEFAULT 'LIVE_RUN'
    CHECK (entry_source IN ('LIVE_RUN','OPENING_ONBOARDING','MIGRATION','ADJUSTMENT'));

-- Backfill existing rows
UPDATE depreciation_ledger SET entry_source = 'LIVE_RUN' WHERE entry_source IS NULL;

-- 1b. policy_version: links to the depreciation rule snapshot active at computation time
--     This is a descriptive string, not a FK, because KVS rules change via circulars
ALTER TABLE depreciation_ledger
  ADD COLUMN IF NOT EXISTS policy_version VARCHAR(50)
    DEFAULT 'KVS_2021_CIRCULAR';

-- Backfill
UPDATE depreciation_ledger SET policy_version = 'KVS_2021_CIRCULAR' WHERE policy_version IS NULL;


-- ────────────────────────────────────────────────────────────
-- 2. ASSET TABLE — Onboarding snapshot (immutable after creation)
-- ────────────────────────────────────────────────────────────

-- Financial year in which this asset was onboarded into the system
ALTER TABLE asset
  ADD COLUMN IF NOT EXISTS onboarding_fy VARCHAR(7);

-- When the onboarding history was auto-generated
ALTER TABLE asset
  ADD COLUMN IF NOT EXISTS onboarding_generated_at TIMESTAMPTZ;

-- Opening book value computed during onboarding (before any live depreciation)
ALTER TABLE asset
  ADD COLUMN IF NOT EXISTS onboarding_opening_book_value DECIMAL(14,2);

-- Accumulated depreciation computed during onboarding
ALTER TABLE asset
  ADD COLUMN IF NOT EXISTS onboarding_accumulated_depreciation DECIMAL(14,2);

-- Which depreciation method was used for onboarding ('WDV' / 'SLM' / 'BOTH')
ALTER TABLE asset
  ADD COLUMN IF NOT EXISTS onboarding_method_basis VARCHAR(20);

-- Source of onboarding ('OPENING_ONBOARDING' / 'MIGRATION' / etc.)
ALTER TABLE asset
  ADD COLUMN IF NOT EXISTS onboarding_entry_source VARCHAR(20)
    CHECK (onboarding_entry_source IN ('OPENING_ONBOARDING','MIGRATION'));


-- ────────────────────────────────────────────────────────────
-- 3. FINANCIAL YEAR — System-generated flag
-- ────────────────────────────────────────────────────────────

-- Historical FYs auto-created during onboarding are internal-only.
-- They MUST NOT appear in user-facing FY management screens.
ALTER TABLE financial_year
  ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN DEFAULT false;

-- Track when depreciation was run for this FY (operational metadata)
ALTER TABLE financial_year
  ADD COLUMN IF NOT EXISTS depreciation_run_at TIMESTAMPTZ;


-- ────────────────────────────────────────────────────────────
-- 4. CONDEMNATION ITEMS — Immutable snapshot enrichment
-- ────────────────────────────────────────────────────────────

-- Book value at the exact moment of condemnation (independent of future asset changes)
ALTER TABLE condemnation_items
  ADD COLUMN IF NOT EXISTS book_value_at_condemnation DECIMAL(14,2);

-- Depreciation method used for the asset at condemnation time
ALTER TABLE condemnation_items
  ADD COLUMN IF NOT EXISTS depreciation_method VARCHAR(20);

-- Policy version active at condemnation time
ALTER TABLE condemnation_items
  ADD COLUMN IF NOT EXISTS policy_version VARCHAR(50);

-- Also enrich condemnation_entry (legacy single-asset condemnation) with same fields
ALTER TABLE condemnation_entry
  ADD COLUMN IF NOT EXISTS book_value_at_condemnation DECIMAL(14,2);

ALTER TABLE condemnation_entry
  ADD COLUMN IF NOT EXISTS depreciation_method VARCHAR(20);

ALTER TABLE condemnation_entry
  ADD COLUMN IF NOT EXISTS policy_version VARCHAR(50);


-- ────────────────────────────────────────────────────────────
-- 5. TRIGGER: Sequential Depreciation Enforcement (LIVE_RUN only)
-- ────────────────────────────────────────────────────────────
-- Prevents out-of-order depreciation for normal operations.
-- Safely bypassed for OPENING_ONBOARDING entries.

CREATE OR REPLACE FUNCTION enforce_sequential_depreciation() RETURNS TRIGGER AS $$
DECLARE
  prev_fy_code VARCHAR(7);
  prev_fy_exists BOOLEAN;
  asset_purchase_fy VARCHAR(7);
  purchase_fy_start INT;
  target_fy_start INT;
BEGIN
  -- BYPASS: Onboarding and migration entries skip sequential checks
  IF NEW.entry_source IN ('OPENING_ONBOARDING', 'MIGRATION') THEN
    RETURN NEW;
  END IF;

  -- Determine the FY in which the asset was purchased
  SELECT CASE
    WHEN EXTRACT(MONTH FROM a.purchase_date) >= 4
    THEN EXTRACT(YEAR FROM a.purchase_date) || '-' || SUBSTR((EXTRACT(YEAR FROM a.purchase_date) + 1)::TEXT, 3, 2)
    ELSE (EXTRACT(YEAR FROM a.purchase_date) - 1) || '-' || SUBSTR(EXTRACT(YEAR FROM a.purchase_date)::TEXT, 3, 2)
  END INTO asset_purchase_fy
  FROM asset a WHERE a.id = NEW.asset_id;

  -- If this is the purchase FY, no previous FY check needed
  IF NEW.financial_year = asset_purchase_fy THEN
    RETURN NEW;
  END IF;

  -- Calculate previous FY code from the target FY
  target_fy_start := LEFT(NEW.financial_year, 4)::INT;
  prev_fy_code := (target_fy_start - 1)::TEXT || '-' || SUBSTR(target_fy_start::TEXT, 3, 2);

  -- If previous FY is before purchase FY, allow (asset didn't exist yet)
  purchase_fy_start := LEFT(asset_purchase_fy, 4)::INT;
  IF (target_fy_start - 1) < purchase_fy_start THEN
    RETURN NEW;
  END IF;

  -- Check that depreciation exists for the previous FY for this asset
  SELECT EXISTS(
    SELECT 1 FROM depreciation_ledger
    WHERE asset_id = NEW.asset_id AND financial_year = prev_fy_code
  ) INTO prev_fy_exists;

  IF NOT prev_fy_exists THEN
    RAISE EXCEPTION 'Sequential depreciation violation: FY % requires FY % to be depreciated first for asset_id=%',
      NEW.financial_year, prev_fy_code, NEW.asset_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sequential_depreciation
  BEFORE INSERT ON depreciation_ledger
  FOR EACH ROW EXECUTE FUNCTION enforce_sequential_depreciation();


-- ────────────────────────────────────────────────────────────
-- 6. MODIFY TRIGGER: FY Lock bypass for onboarding
-- ────────────────────────────────────────────────────────────
-- The existing enforce_fy_lock() trigger blocks ALL inserts into closed FYs.
-- Onboarding MUST be able to write to historical (closed) FYs.
-- We replace the function to check entry_source when applicable.

CREATE OR REPLACE FUNCTION enforce_fy_lock() RETURNS TRIGGER AS $$
DECLARE
  fy_closed BOOLEAN;
BEGIN
  SELECT is_closed INTO fy_closed
    FROM financial_year WHERE code = NEW.financial_year;

  IF fy_closed IS TRUE THEN
    -- Allow onboarding/migration entries to bypass FY lock on depreciation_ledger
    IF TG_TABLE_NAME = 'depreciation_ledger' AND NEW.entry_source IN ('OPENING_ONBOARDING', 'MIGRATION') THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Financial year % is closed. No modifications allowed.', NEW.financial_year;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;


-- ────────────────────────────────────────────────────────────
-- 7. INDEXES for new columns
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_depr_entry_source ON depreciation_ledger(entry_source);
CREATE INDEX IF NOT EXISTS idx_fy_system_generated ON financial_year(is_system_generated);
CREATE INDEX IF NOT EXISTS idx_asset_onboarding_fy ON asset(onboarding_fy) WHERE onboarding_fy IS NOT NULL;

COMMIT;
