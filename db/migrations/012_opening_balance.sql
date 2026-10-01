-- Migration 012: Opening Balance Snapshot Table
-- Enables Vidyalayas to enter carry-forward physical register figures
-- (Gross Block and Accumulated Depreciation) per Asset Head and Funding Head.

-- Ensure stock_ledger supports stock_volume_no
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS stock_volume_no INT;

CREATE TABLE IF NOT EXISTS opening_balance_snapshot (
    id SERIAL PRIMARY KEY,
    vidyalaya_id INTEGER NOT NULL REFERENCES vidyalaya(id) ON DELETE CASCADE,
    financial_year VARCHAR(7) NOT NULL, -- Format: YYYY-YY (e.g. '2025-26')
    department_id INTEGER NOT NULL REFERENCES department(id), -- Asset Head
    funding_head_id INTEGER NOT NULL REFERENCES funding_head(id),
    opening_gross_value DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    opening_accum_depreciation DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    remarks TEXT,
    created_by INTEGER REFERENCES "user"(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_opening_balance UNIQUE (vidyalaya_id, financial_year, department_id, funding_head_id),
    CONSTRAINT chk_gross_non_negative CHECK (opening_gross_value >= 0),
    CONSTRAINT chk_depr_non_negative CHECK (opening_accum_depreciation >= 0),
    CONSTRAINT chk_depr_le_gross CHECK (opening_accum_depreciation <= opening_gross_value)
);

CREATE INDEX IF NOT EXISTS idx_opening_balance_lookup 
ON opening_balance_snapshot(vidyalaya_id, financial_year);

COMMENT ON TABLE opening_balance_snapshot IS 'Stores baseline carry-forward physical register balances at system adoption';
COMMENT ON COLUMN opening_balance_snapshot.opening_gross_value IS 'Gross Block (original purchase cost) carry-forward from physical register';
COMMENT ON COLUMN opening_balance_snapshot.opening_accum_depreciation IS 'Accumulated depreciation carry-forward from physical register';
