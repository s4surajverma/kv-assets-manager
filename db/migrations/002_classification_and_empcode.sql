-- ============================================================
-- 002: Classification Workflow + Employee Code Enforcement
-- ============================================================
BEGIN;

-- 1. Add classification_status to stock_ledger
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS classification_status VARCHAR(20) DEFAULT 'CLASSIFIED'
  CHECK (classification_status IN ('PENDING', 'CLASSIFIED'));

-- 2. Make funding_head_id nullable (entries created without it, classified later)
ALTER TABLE stock_ledger ALTER COLUMN funding_head_id DROP NOT NULL;

-- 3. Make department_id (asset_head) nullable
ALTER TABLE stock_ledger ALTER COLUMN department_id DROP NOT NULL;

-- 4. All existing entries are already classified
UPDATE stock_ledger SET classification_status = 'CLASSIFIED' WHERE classification_status IS NULL;

-- 5. Add employee_code to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS employee_code VARCHAR(30);

-- 6. Backfill existing users with placeholder codes
UPDATE "user" SET employee_code = 'EMP' || LPAD(id::TEXT, 3, '0') WHERE employee_code IS NULL;

-- 7. Enforce NOT NULL and UNIQUE
ALTER TABLE "user" ALTER COLUMN employee_code SET NOT NULL;
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_employee_code_unique;
ALTER TABLE "user" ADD CONSTRAINT user_employee_code_unique UNIQUE (employee_code);

-- 8. Index for classification status lookups
CREATE INDEX IF NOT EXISTS idx_stock_classification ON stock_ledger(classification_status);

COMMIT;
