-- Add is_donation flag to track items received as donations (no actual cash expenditure)
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS is_donation BOOLEAN DEFAULT false;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS is_donation BOOLEAN DEFAULT false;
