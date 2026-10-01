-- Migration Script for Asset Head and Operational Department separation

BEGIN;

-- 1. Ensure stock_ledger.department_id (acting as asset_head) is nullable for CS24A
ALTER TABLE stock_ledger ALTER COLUMN department_id DROP NOT NULL;

-- 2. Create the new operational_department table
CREATE TABLE IF NOT EXISTS operational_department (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    incharge_id INT REFERENCES "user"(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add operational_department_id to core tables
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS operational_department_id INT REFERENCES operational_department(id);
ALTER TABLE asset ADD COLUMN IF NOT EXISTS operational_department_id INT REFERENCES operational_department(id);

-- Note: The user table already has department_id, which currently points to the old department (asset_head). 
-- Let's add operational_department_id to user to make the transition clean and safe.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS operational_department_id INT REFERENCES operational_department(id);

-- 4. Add operational_department_id to verification table
ALTER TABLE verification ADD COLUMN IF NOT EXISTS operational_department_id INT REFERENCES operational_department(id);
ALTER TABLE verification ALTER COLUMN department_id DROP NOT NULL;
ALTER TABLE verification DROP CONSTRAINT IF EXISTS verification_financial_year_department_id_key;
ALTER TABLE verification ADD CONSTRAINT verification_financial_year_op_dept_id_key UNIQUE(financial_year, operational_department_id);

COMMIT;
