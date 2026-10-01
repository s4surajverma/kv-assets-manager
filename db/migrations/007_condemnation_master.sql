-- ============================================================
-- 006: Department-Based Multi-Asset Condemnation (CS-49)
-- Creates: condemnation_master, condemnation_items
-- Alters:  asset (status, asset_classification)
--          sanction (condemnation_master_id)
--          disposal (condemnation_master_id)
-- ============================================================

BEGIN;

-- ── 1. Extend asset.status to include UNDER_CONDEMNATION ──────────────────
ALTER TABLE asset DROP CONSTRAINT IF EXISTS asset_status_check;
ALTER TABLE asset ADD CONSTRAINT asset_status_check
  CHECK (status IN ('ACTIVE','UNDER_CONDEMNATION','CONDEMNED','DISPOSED','TRANSFERRED'));

-- ── 2. Add asset_classification (policy-driven, replaces is_small_value logic) ──
ALTER TABLE asset
  ADD COLUMN IF NOT EXISTS asset_classification VARCHAR(20)
    DEFAULT 'CAPITAL'
    CHECK (asset_classification IN ('CAPITAL','REVENUE','UNCLASSIFIED'));

-- Backfill all existing records as CAPITAL (safe default, preserves behaviour)
UPDATE asset SET asset_classification = 'CAPITAL' WHERE asset_classification IS NULL;

-- ── 3. Create condemnation_master ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS condemnation_master (
  id                        SERIAL PRIMARY KEY,
  vidyalaya_id              INT NOT NULL REFERENCES vidyalaya(id),
  operational_department_id INT NOT NULL REFERENCES operational_department(id),
  funding_head_id           INT NOT NULL REFERENCES funding_head(id),
  financial_year            VARCHAR(7) NOT NULL REFERENCES financial_year(code),
  depreciation_method       VARCHAR(20) NOT NULL DEFAULT 'BOTH'
                              CHECK (depreciation_method IN ('SLM_PRE_2011','WDV_POST_2011','BOTH')),
  reason                    TEXT NOT NULL,
  date_unserviceable        DATE,
  board_date                DATE,
  status                    VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING','BOARD_REVIEWED','SANCTIONED','REJECTED','DISPOSED')),
  cert_info_correct         BOOLEAN DEFAULT false,
  cert_normal_wear          BOOLEAN DEFAULT false,
  cert_board_report         BOOLEAN DEFAULT false,
  stock_incharge_id         INT REFERENCES "user"(id),
  checker_id                INT REFERENCES "user"(id),
  total_original_cost       DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_depreciation        DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_condemnation_cost   DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_depreciated_value   DECIMAL(14,2) NOT NULL DEFAULT 0,
  remarks                   TEXT,
  created_by                INT NOT NULL REFERENCES "user"(id),
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Create condemnation_items ──────────────────────────────────────────
-- department_id: historical snapshot of asset.department_id at creation time.
--                Auto-copied during INSERT. Never independently editable via API.
CREATE TABLE IF NOT EXISTS condemnation_items (
  id                      SERIAL PRIMARY KEY,
  condemnation_master_id  INT NOT NULL REFERENCES condemnation_master(id) ON DELETE CASCADE,
  asset_id                INT NOT NULL REFERENCES asset(id),
  department_id           INT NOT NULL REFERENCES department(id),  -- snapshot: Asset Head at time of condemnation
  quantity_condemned       INT NOT NULL DEFAULT 1,
  original_cost           DECIMAL(14,2) NOT NULL,
  total_depreciation      DECIMAL(14,2) NOT NULL,
  cap_95_value            DECIMAL(14,2) NOT NULL,
  condemnation_cost       DECIMAL(14,2) NOT NULL,
  depreciated_value       DECIMAL(14,2) NOT NULL,
  depr_pre_2011           DECIMAL(14,2) DEFAULT 0,
  depr_post_2011          DECIMAL(14,2) DEFAULT 0,
  years_pre_2011          INT DEFAULT 0,
  years_post_2011         INT DEFAULT 0,
  slm_rate_pre            DECIMAL(5,4),
  wdv_rate_post           DECIMAL(5,4),
  date_unserviceable      DATE,
  model_serial_no         VARCHAR(100),
  remarks                 TEXT,
  CONSTRAINT no_double_condemn_new UNIQUE (asset_id)
);

-- ── 5. Alter sanction: add nullable condemnation_master_id ────────────────
ALTER TABLE sanction
  ADD COLUMN IF NOT EXISTS condemnation_master_id INT REFERENCES condemnation_master(id);

-- Make condemnation_id nullable so new records can omit it
ALTER TABLE sanction ALTER COLUMN condemnation_id DROP NOT NULL;

-- Enforce: exactly one source must be set
ALTER TABLE sanction DROP CONSTRAINT IF EXISTS sanction_one_source;
ALTER TABLE sanction ADD CONSTRAINT sanction_one_source CHECK (
  (condemnation_id IS NOT NULL AND condemnation_master_id IS NULL)
  OR
  (condemnation_id IS NULL AND condemnation_master_id IS NOT NULL)
);

-- ── 6. Alter disposal: add nullable condemnation_master_id ────────────────
ALTER TABLE disposal
  ADD COLUMN IF NOT EXISTS condemnation_master_id INT REFERENCES condemnation_master(id);

ALTER TABLE disposal ALTER COLUMN condemnation_id DROP NOT NULL;

ALTER TABLE disposal DROP CONSTRAINT IF EXISTS disposal_one_source;
ALTER TABLE disposal ADD CONSTRAINT disposal_one_source CHECK (
  (condemnation_id IS NOT NULL AND condemnation_master_id IS NULL)
  OR
  (condemnation_id IS NULL AND condemnation_master_id IS NOT NULL)
);

-- ── 7. Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cm_vidyalaya  ON condemnation_master(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_cm_op_dept    ON condemnation_master(operational_department_id);
CREATE INDEX IF NOT EXISTS idx_cm_fund       ON condemnation_master(funding_head_id);
CREATE INDEX IF NOT EXISTS idx_cm_status     ON condemnation_master(status);
CREATE INDEX IF NOT EXISTS idx_cm_fy         ON condemnation_master(financial_year);
CREATE INDEX IF NOT EXISTS idx_ci_master     ON condemnation_items(condemnation_master_id);
CREATE INDEX IF NOT EXISTS idx_ci_asset      ON condemnation_items(asset_id);
CREATE INDEX IF NOT EXISTS idx_ci_dept       ON condemnation_items(department_id);
CREATE INDEX IF NOT EXISTS idx_asset_classif ON asset(asset_classification);

COMMIT;
