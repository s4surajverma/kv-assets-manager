-- ============================================================
-- 005: Multi-Tenant Architecture — Vidyalaya Table + Tenant Isolation
-- ============================================================
-- This migration:
--   1. Creates the vidyalaya table
--   2. Adds vidyalaya_id (FK, ON DELETE RESTRICT) to all tenant-scoped tables
--   3. Backfills existing data to a "Legacy KV" (id=1)
--   4. Adds NOT NULL constraints, indexes, and unique constraints
--   5. Creates a DB trigger to protect the Legacy KV (is_system=true)
--   6. Adds reset_token fields for KV Admin password resets
-- ============================================================

BEGIN;

-- ==================== 1. VIDYALAYA TABLE ====================
CREATE TABLE IF NOT EXISTS vidyalaya (
  id              SERIAL PRIMARY KEY,
  kv_code            VARCHAR(50) UNIQUE NOT NULL,
  kv_name_en         VARCHAR(200) NOT NULL,
  kv_name_hi         VARCHAR(200) NOT NULL,
  regional_office_en VARCHAR(100) NOT NULL,
  regional_office_hi VARCHAR(100) NOT NULL,
  status             VARCHAR(20) DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  is_active          BOOLEAN DEFAULT true,
  is_system          BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== 2. LEGACY KV (backfill anchor) ====================
INSERT INTO vidyalaya (id, kv_code, kv_name_en, kv_name_hi, regional_office_en, regional_office_hi, status, is_active, is_system)
VALUES (1, 'LEGACY', 'Legacy KV (System)', 'विरासत केवी (सिस्टम)', 'System', 'प्रणाली', 'APPROVED', true, true)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence so next vidyalaya starts at id=2
SELECT setval('vidyalaya_id_seq', (SELECT COALESCE(MAX(id), 1) FROM vidyalaya));

-- ==================== 3. ADD vidyalaya_id TO ALL TENANT TABLES ====================

-- 3a. user
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE "user" SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE "user" ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3b. operational_department
ALTER TABLE operational_department ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE operational_department SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE operational_department ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3c. location
ALTER TABLE location ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE location SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE location ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3d. supplier
ALTER TABLE supplier ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE supplier SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE supplier ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3e. stock_ledger
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE stock_ledger SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE stock_ledger ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3f. asset
ALTER TABLE asset ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE asset SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE asset ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3g. depreciation_ledger
ALTER TABLE depreciation_ledger ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE depreciation_ledger SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE depreciation_ledger ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3h. condemnation_entry
ALTER TABLE condemnation_entry ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE condemnation_entry SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE condemnation_entry ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3i. sanction
ALTER TABLE sanction ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE sanction SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE sanction ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3j. disposal
ALTER TABLE disposal ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE disposal SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE disposal ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3k. verification
ALTER TABLE verification ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE verification SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE verification ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3l. consumable_issue
ALTER TABLE consumable_issue ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE consumable_issue SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE consumable_issue ALTER COLUMN vidyalaya_id SET NOT NULL;

-- 3m. audit_log (write unconditionally, filter only on read)
-- Must temporarily disable immutability triggers to backfill
ALTER TABLE audit_log DISABLE TRIGGER trg_audit_no_update;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS vidyalaya_id INT REFERENCES vidyalaya(id) ON DELETE RESTRICT;
UPDATE audit_log SET vidyalaya_id = 1 WHERE vidyalaya_id IS NULL;
ALTER TABLE audit_log ENABLE TRIGGER trg_audit_no_update;
-- NOTE: audit_log.vidyalaya_id is intentionally NULLABLE for system-level entries

-- ==================== 4. INDEXES ON vidyalaya_id ====================
CREATE INDEX IF NOT EXISTS idx_user_vidyalaya ON "user"(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_op_dept_vidyalaya ON operational_department(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_location_vidyalaya ON location(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_supplier_vidyalaya ON supplier(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_stock_vidyalaya ON stock_ledger(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_asset_vidyalaya ON asset(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_depr_vidyalaya ON depreciation_ledger(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_condemn_vidyalaya ON condemnation_entry(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_sanction_vidyalaya ON sanction(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_disposal_vidyalaya ON disposal(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_verification_vidyalaya ON verification(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_consumable_vidyalaya ON consumable_issue(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_audit_vidyalaya ON audit_log(vidyalaya_id);

-- ==================== 5. UNIQUE CONSTRAINT: employee_code per vidyalaya ====================
-- First drop the old global unique constraint (from 002_classification_and_empcode.sql)
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_employee_code_unique;
-- Add tenant-scoped uniqueness
ALTER TABLE "user" ADD CONSTRAINT user_vidyalaya_empcode_unique UNIQUE (vidyalaya_id, employee_code);

-- ==================== 6. PASSWORD RESET FIELDS FOR KV ADMIN ====================
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;

-- ==================== 7. LEGACY KV PROTECTION TRIGGER ====================
-- Prevents any UPDATE or DELETE on vidyalaya rows where is_system = true
CREATE OR REPLACE FUNCTION protect_system_vidyalaya() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system = true THEN
      RAISE EXCEPTION 'Cannot delete system Vidyalaya (id=%). This record is protected.', OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_system = true THEN
      RAISE EXCEPTION 'Cannot modify system Vidyalaya (id=%). This record is protected.', OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_system_vidyalaya ON vidyalaya;
CREATE TRIGGER trg_protect_system_vidyalaya
  BEFORE UPDATE OR DELETE ON vidyalaya
  FOR EACH ROW EXECUTE FUNCTION protect_system_vidyalaya();

COMMIT;
