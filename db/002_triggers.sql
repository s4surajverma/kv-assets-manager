-- ============================================================
-- KVS ASSET MANAGEMENT SYSTEM - PRODUCTION SCHEMA
-- PostgreSQL 15+ | Part 2: Triggers + Functions
-- ============================================================

BEGIN;

-- ============================================================
-- TRIGGER 1: Financial Year Lock
-- Blocks INSERT/UPDATE on transactional tables if FY is closed
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_fy_lock() RETURNS TRIGGER AS $$
DECLARE
  fy_closed BOOLEAN;
BEGIN
  SELECT is_closed INTO fy_closed
    FROM financial_year WHERE code = NEW.financial_year;

  IF fy_closed IS TRUE THEN
    RAISE EXCEPTION 'Financial year % is closed. No modifications allowed.', NEW.financial_year;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fy_lock_stock
  BEFORE INSERT OR UPDATE ON stock_ledger
  FOR EACH ROW EXECUTE FUNCTION enforce_fy_lock();

CREATE TRIGGER trg_fy_lock_depr
  BEFORE INSERT OR UPDATE ON depreciation_ledger
  FOR EACH ROW EXECUTE FUNCTION enforce_fy_lock();

CREATE TRIGGER trg_fy_lock_condemn
  BEFORE INSERT OR UPDATE ON condemnation_entry
  FOR EACH ROW EXECUTE FUNCTION enforce_fy_lock();

CREATE TRIGGER trg_fy_lock_sanction
  BEFORE INSERT OR UPDATE ON sanction
  FOR EACH ROW EXECUTE FUNCTION enforce_fy_lock();


-- ============================================================
-- TRIGGER 2: Running Balance (no negative stock)
-- Auto-computes balance_after on every stock_ledger INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION compute_running_balance() RETURNS TRIGGER AS $$
DECLARE
  prev_balance DECIMAL(10,2);
  delta DECIMAL(10,2);
BEGIN
  -- Get latest balance for same item+dept+fund+ledger_type
  SELECT COALESCE(balance_after, 0) INTO prev_balance
    FROM stock_ledger
    WHERE department_id = NEW.department_id
      AND funding_head_id = NEW.funding_head_id
      AND item_description = NEW.item_description
      AND ledger_type = NEW.ledger_type
      AND id != NEW.id
    ORDER BY entry_date DESC, id DESC
    LIMIT 1;

  IF prev_balance IS NULL THEN
    prev_balance := 0;
  END IF;

  CASE NEW.entry_type
    WHEN 'RECEIPT'    THEN delta := NEW.quantity;
    WHEN 'RETURN'     THEN delta := NEW.quantity;
    WHEN 'OPENING'    THEN delta := NEW.quantity;
    WHEN 'ISSUE'      THEN delta := -NEW.quantity;
    WHEN 'WRITE_OFF'  THEN delta := -NEW.quantity;
    WHEN 'ADJUSTMENT' THEN delta := NEW.quantity; -- can be negative via signed qty
  END CASE;

  NEW.balance_after := prev_balance + delta;

  IF NEW.balance_after < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for "%": current balance=%, requested=%',
      NEW.item_description, prev_balance, NEW.quantity;
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_running_balance
  BEFORE INSERT ON stock_ledger
  FOR EACH ROW EXECUTE FUNCTION compute_running_balance();


-- ============================================================
-- TRIGGER 3: Asset Source Enforcement
-- Assets can only be created from CS-24 RECEIPT entries
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_asset_stock_source() RETURNS TRIGGER AS $$
DECLARE
  src_ledger_type VARCHAR(6);
  src_entry_type VARCHAR(20);
BEGIN
  SELECT ledger_type, entry_type INTO src_ledger_type, src_entry_type
    FROM stock_ledger WHERE id = NEW.stock_ledger_id;

  IF src_ledger_type = 'CS24A' THEN
    RAISE EXCEPTION 'Assets cannot be created from consumable (CS-24A) stock entries';
  END IF;

  IF src_entry_type != 'RECEIPT' AND src_entry_type != 'OPENING' THEN
    RAISE EXCEPTION 'Assets can only be created from RECEIPT or OPENING stock entries, got: %', src_entry_type;
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asset_stock_source
  BEFORE INSERT ON asset
  FOR EACH ROW EXECUTE FUNCTION enforce_asset_stock_source();


-- ============================================================
-- TRIGGER 4: Auto Small-Value Flag
-- Sets is_small_value when cost <= 2000 and not library
-- ============================================================
CREATE OR REPLACE FUNCTION auto_small_value_flag() RETURNS TRIGGER AS $$
DECLARE
  cat_is_library BOOLEAN;
BEGIN
  SELECT is_library INTO cat_is_library
    FROM asset_category WHERE id = NEW.category_id;

  IF NEW.total_cost <= 2000 AND cat_is_library IS NOT TRUE THEN
    NEW.is_small_value := true;
    NEW.book_value := 0;
    NEW.accum_depreciation := NEW.total_cost;
  ELSE
    NEW.is_small_value := false;
    IF NEW.book_value IS NULL THEN
      NEW.book_value := NEW.total_cost;
    END IF;
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_small_value
  BEFORE INSERT ON asset
  FOR EACH ROW EXECUTE FUNCTION auto_small_value_flag();


-- ============================================================
-- TRIGGER 5: Sanction Authority Limit Enforcement
-- Principal <= 500, VMC <= 200000/year
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_sanction_limits() RETURNS TRIGGER AS $$
DECLARE
  vmc_used DECIMAL(14,2);
BEGIN
  IF NEW.sanctioning_authority = 'PRINCIPAL' THEN
    IF NEW.sanctioned_amount > 500 THEN
      RAISE EXCEPTION 'Principal can only sanction up to Rs.500. Amount Rs.% requires VMC approval.',
        NEW.sanctioned_amount;
    END IF;

  ELSIF NEW.sanctioning_authority = 'VMC' THEN
    SELECT COALESCE(SUM(sanctioned_amount), 0) INTO vmc_used
      FROM sanction
      WHERE sanctioning_authority = 'VMC'
        AND financial_year = NEW.financial_year;

    IF (vmc_used + NEW.sanctioned_amount) > 200000 THEN
      RAISE EXCEPTION 'VMC yearly limit Rs.2,00,000. Used: Rs.%. Remaining: Rs.%. Amount Rs.% requires Regional Officer approval.',
        vmc_used, (200000 - vmc_used), NEW.sanctioned_amount;
    END IF;
  END IF;

  -- REGIONAL_OFFICER and KVS_HQ have no limits
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sanction_limits
  BEFORE INSERT ON sanction
  FOR EACH ROW EXECUTE FUNCTION enforce_sanction_limits();


-- ============================================================
-- TRIGGER 6: Condemnation Status Validation
-- Enforces state machine: PENDING -> BOARD_REVIEWED -> SANCTIONED -> DISPOSED
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_condemnation_state() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Valid transitions
    IF OLD.status != NEW.status THEN
      IF OLD.status = 'PENDING' AND NEW.status NOT IN ('BOARD_REVIEWED', 'REJECTED') THEN
        RAISE EXCEPTION 'PENDING can only transition to BOARD_REVIEWED or REJECTED';
      END IF;
      IF OLD.status = 'BOARD_REVIEWED' AND NEW.status NOT IN ('SANCTIONED', 'REJECTED') THEN
        RAISE EXCEPTION 'BOARD_REVIEWED can only transition to SANCTIONED or REJECTED';
      END IF;
      IF OLD.status = 'SANCTIONED' AND NEW.status != 'DISPOSED' THEN
        RAISE EXCEPTION 'SANCTIONED can only transition to DISPOSED';
      END IF;
      IF OLD.status IN ('REJECTED', 'DISPOSED') THEN
        RAISE EXCEPTION 'Cannot transition from terminal status: %', OLD.status;
      END IF;
    END IF;

    -- Board review requires certifications
    IF NEW.status = 'BOARD_REVIEWED' THEN
      IF NOT (NEW.cert_info_correct AND NEW.cert_normal_wear AND NEW.cert_board_report) THEN
        RAISE EXCEPTION 'All 3 CS-49 certifications required before board review';
      END IF;
      IF NEW.board_date IS NULL THEN
        RAISE EXCEPTION 'Board date is required for board review';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_condemnation_state
  BEFORE UPDATE ON condemnation_entry
  FOR EACH ROW EXECUTE FUNCTION enforce_condemnation_state();


-- ============================================================
-- TRIGGER 7: Asset Status Update on Condemnation/Disposal
-- ============================================================
CREATE OR REPLACE FUNCTION sync_asset_status_on_condemn() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SANCTIONED' AND OLD.status != 'SANCTIONED' THEN
    UPDATE asset SET status = 'CONDEMNED', updated_at = NOW()
      WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asset_condemn_sync
  AFTER UPDATE ON condemnation_entry
  FOR EACH ROW EXECUTE FUNCTION sync_asset_status_on_condemn();

CREATE OR REPLACE FUNCTION sync_asset_status_on_disposal() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_received IS TRUE THEN
    UPDATE asset SET status = 'DISPOSED', updated_at = NOW()
      WHERE id = (SELECT asset_id FROM condemnation_entry WHERE id = NEW.condemnation_id);
    UPDATE condemnation_entry SET status = 'DISPOSED', updated_at = NOW()
      WHERE id = NEW.condemnation_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asset_disposal_sync
  AFTER INSERT OR UPDATE ON disposal
  FOR EACH ROW EXECUTE FUNCTION sync_asset_status_on_disposal();


-- ============================================================
-- TRIGGER 8: Immutable Audit Log
-- Blocks UPDATE and DELETE on audit_log
-- ============================================================
CREATE OR REPLACE FUNCTION block_audit_modification() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable. % operations are prohibited.', TG_OP;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION block_audit_modification();

CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION block_audit_modification();


-- ============================================================
-- TRIGGER 9: Auto Audit Logging
-- Logs all changes on core tables to audit_log
-- ============================================================
CREATE OR REPLACE FUNCTION auto_audit_log() RETURNS TRIGGER AS $$
DECLARE
  _changed_by INT;
  _rec jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _rec := to_jsonb(OLD);
    _changed_by := COALESCE( (_rec->>'created_by')::INT, (_rec->>'computed_by')::INT, (_rec->>'sanctioned_by')::INT, (_rec->>'verified_by')::INT, 0 );
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', _rec, _changed_by);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _rec := to_jsonb(NEW);
    _changed_by := COALESCE( (_rec->>'created_by')::INT, (_rec->>'computed_by')::INT, (_rec->>'sanctioned_by')::INT, (_rec->>'verified_by')::INT, 0 );
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), _rec, _changed_by);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    _rec := to_jsonb(NEW);
    _changed_by := COALESCE( (_rec->>'created_by')::INT, (_rec->>'computed_by')::INT, (_rec->>'sanctioned_by')::INT, (_rec->>'verified_by')::INT, 0 );
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', _rec, _changed_by);
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

-- Apply to all core tables
CREATE TRIGGER trg_audit_stock_ledger
  AFTER INSERT OR UPDATE OR DELETE ON stock_ledger
  FOR EACH ROW EXECUTE FUNCTION auto_audit_log();

CREATE TRIGGER trg_audit_asset
  AFTER INSERT OR UPDATE OR DELETE ON asset
  FOR EACH ROW EXECUTE FUNCTION auto_audit_log();

CREATE TRIGGER trg_audit_depreciation
  AFTER INSERT OR UPDATE OR DELETE ON depreciation_ledger
  FOR EACH ROW EXECUTE FUNCTION auto_audit_log();

CREATE TRIGGER trg_audit_condemnation
  AFTER INSERT OR UPDATE OR DELETE ON condemnation_entry
  FOR EACH ROW EXECUTE FUNCTION auto_audit_log();

CREATE TRIGGER trg_audit_sanction
  AFTER INSERT OR UPDATE OR DELETE ON sanction
  FOR EACH ROW EXECUTE FUNCTION auto_audit_log();

CREATE TRIGGER trg_audit_disposal
  AFTER INSERT OR UPDATE OR DELETE ON disposal
  FOR EACH ROW EXECUTE FUNCTION auto_audit_log();

CREATE TRIGGER trg_audit_verification
  AFTER INSERT OR UPDATE OR DELETE ON verification
  FOR EACH ROW EXECUTE FUNCTION auto_audit_log();


-- ============================================================
-- HELPER: Generate Asset Number
-- Format: KVS-{DEPT}-{FY}-{SEQ}
-- ============================================================
CREATE OR REPLACE FUNCTION generate_asset_number(
  p_dept_code VARCHAR, p_fy VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
  seq INT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
    FROM asset a
    JOIN department d ON d.id = a.department_id
    WHERE d.code = p_dept_code
      AND to_char(a.purchase_date, 'YYYY') = LEFT(p_fy, 4);

  RETURN 'KVS-' || p_dept_code || '-' || p_fy || '-' || LPAD(seq::TEXT, 4, '0');
END; $$ LANGUAGE plpgsql;


-- ============================================================
-- HELPER: Get Current Financial Year
-- ============================================================
CREATE OR REPLACE FUNCTION current_financial_year() RETURNS VARCHAR AS $$
BEGIN
  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    RETURN EXTRACT(YEAR FROM CURRENT_DATE) || '-' ||
           SUBSTR((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT, 3, 2);
  ELSE
    RETURN (EXTRACT(YEAR FROM CURRENT_DATE) - 1) || '-' ||
           SUBSTR(EXTRACT(YEAR FROM CURRENT_DATE)::TEXT, 3, 2);
  END IF;
END; $$ LANGUAGE plpgsql;


-- ============================================================
-- REVOKE dangerous permissions on audit_log
-- ============================================================
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;


COMMIT;
