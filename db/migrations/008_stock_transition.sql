-- ============================================================
-- 007: Stock Charge Transfer / Handing Over – Taking Over
-- ============================================================
-- This migration creates:
--   1. stock_transition_master  — workflow header
--   2. stock_transition_items   — frozen asset snapshot per transition
--   3. Lifecycle Guard Trigger  — enforces state matrix + immutability
--   4. Item Immutability Trigger — prevents edits when parent is finalized
--   5. Deletion Prevention      — blocks physical DELETE on both tables
-- ============================================================

BEGIN;

-- ==================== 1. MASTER TABLE ====================
CREATE TABLE IF NOT EXISTS stock_transition_master (
    id SERIAL PRIMARY KEY,
    vidyalaya_id INT NOT NULL REFERENCES vidyalaya(id) ON DELETE RESTRICT,
    operational_department_id INT NOT NULL REFERENCES operational_department(id) ON DELETE RESTRICT,

    -- Participants (FK references for relational integrity)
    handed_over_by_user_id INT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    taken_over_by_user_id INT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    initiated_by INT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    verified_by INT REFERENCES "user"(id) ON DELETE RESTRICT,
    principal_id INT REFERENCES "user"(id) ON DELETE SET NULL,

    -- Name Snapshots (preserved even if user profiles change)
    handed_over_by_name VARCHAR(200) NOT NULL,
    taken_over_by_name VARCHAR(200) NOT NULL,
    verified_by_name VARCHAR(200),
    principal_name VARCHAR(200),

    -- Dates
    transition_date DATE NOT NULL DEFAULT CURRENT_DATE,
    verification_date DATE,
    effective_from_date DATE,

    -- Reason
    handover_reason VARCHAR(50)
        CHECK (handover_reason IN ('TRANSFER', 'RETIREMENT', 'ADDITIONAL_CHARGE', 'INTERNAL_REALLOCATION', 'LONG_LEAVE')),

    -- Status
    status VARCHAR(25) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'UNDER_VERIFICATION', 'COMPLETED', 'CANCELLED')),

    -- Official tracking & Report metadata
    official_order_number VARCHAR(50) UNIQUE,
    report_template_version VARCHAR(20) DEFAULT 'v1',
    report_generated_at TIMESTAMPTZ,
    administrative_remarks TEXT,

    -- Frozen summary metrics
    total_items INT DEFAULT 0,
    verified_items INT DEFAULT 0,
    discrepancy_count INT DEFAULT 0,

    -- Cancellation audit trail
    cancelled_by INT REFERENCES "user"(id) ON DELETE RESTRICT,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- System control & Timestamps (always UTC)
    version_no INT DEFAULT 1,
    snapshot_generated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Business rules
    CONSTRAINT reject_self_transfer CHECK (handed_over_by_user_id != taken_over_by_user_id)
);

-- Only one active (DRAFT or UNDER_VERIFICATION) transition per operational department
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_transition
ON stock_transition_master(operational_department_id)
WHERE status IN ('DRAFT', 'UNDER_VERIFICATION');

CREATE INDEX IF NOT EXISTS idx_stock_transition_vidyalaya ON stock_transition_master(vidyalaya_id);
CREATE INDEX IF NOT EXISTS idx_stock_transition_op_dept ON stock_transition_master(operational_department_id);
CREATE INDEX IF NOT EXISTS idx_stock_transition_status ON stock_transition_master(status);

-- ==================== 2. ITEMS TABLE (SNAPSHOT) ====================
CREATE TABLE IF NOT EXISTS stock_transition_items (
    id SERIAL PRIMARY KEY,
    transition_master_id INT NOT NULL REFERENCES stock_transition_master(id) ON DELETE RESTRICT,
    asset_id INT NOT NULL REFERENCES asset(id) ON DELETE RESTRICT,

    -- Snapshot fields (frozen at write-time)
    asset_number VARCHAR(50),
    asset_name VARCHAR(300),
    asset_head_id INT REFERENCES department(id) ON DELETE RESTRICT,
    funding_head_id INT REFERENCES funding_head(id) ON DELETE RESTRICT,
    asset_classification VARCHAR(100),
    asset_status_snapshot VARCHAR(20),
    stock_volume_no INT,
    stock_page_no INT,

    -- Quantities
    quantity_system DECIMAL(10,2) NOT NULL,
    quantity_verified DECIMAL(10,2),

    -- Verification result
    condition_status VARCHAR(20) CHECK (condition_status IN ('GOOD', 'DAMAGED', 'OBSOLETE', 'MISSING')),
    discrepancy_type VARCHAR(50),

    -- Item-level verification remarks
    remarks TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transition_items_master ON stock_transition_items(transition_master_id);

-- ==================== 3. MASTER LIFECYCLE GUARD ====================
-- Consolidated trigger: state matrix + immutability + version bump
CREATE OR REPLACE FUNCTION master_lifecycle_guard() RETURNS TRIGGER AS $$
BEGIN
  -- A. Immutability: Block updates on finalized records
  IF OLD.status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Finalized stock transitions (COMPLETED or CANCELLED) are permanently immutable and cannot be updated.';
  END IF;

  -- B. State Transition Matrix
  IF OLD.status != NEW.status THEN
    IF OLD.status = 'DRAFT' AND NEW.status NOT IN ('UNDER_VERIFICATION', 'CANCELLED') THEN
      RAISE EXCEPTION 'Invalid status transition from DRAFT to %', NEW.status;
    END IF;

    IF OLD.status = 'UNDER_VERIFICATION' AND NEW.status NOT IN ('COMPLETED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Invalid status transition from UNDER_VERIFICATION to %', NEW.status;
    END IF;
  END IF;

  -- C. Optimistic Concurrency: Auto-bump version
  NEW.version_no = OLD.version_no + 1;
  NEW.updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_master_lifecycle_guard
  BEFORE UPDATE ON stock_transition_master
  FOR EACH ROW EXECUTE FUNCTION master_lifecycle_guard();

-- ==================== 4. ITEM IMMUTABILITY GUARD ====================
-- Prevent edits on items when parent master is COMPLETED or CANCELLED
CREATE OR REPLACE FUNCTION protect_finalized_items() RETURNS TRIGGER AS $$
DECLARE
  v_status VARCHAR;
BEGIN
  SELECT status INTO v_status FROM stock_transition_master WHERE id = OLD.transition_master_id;
  IF v_status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Cannot modify items of a finalized stock transition (COMPLETED or CANCELLED).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_items_update
  BEFORE UPDATE ON stock_transition_items
  FOR EACH ROW EXECUTE FUNCTION protect_finalized_items();

-- ==================== 5. DELETION PREVENTION ====================
-- Physical deletion is prohibited; use CANCELLED status instead
CREATE OR REPLACE FUNCTION prevent_transition_deletion() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Physical deletion of stock transitions is not permitted. Use CANCELLED status to preserve audit history.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_master_delete
  BEFORE DELETE ON stock_transition_master
  FOR EACH ROW EXECUTE FUNCTION prevent_transition_deletion();

CREATE TRIGGER trg_prevent_items_delete
  BEFORE DELETE ON stock_transition_items
  FOR EACH ROW EXECUTE FUNCTION prevent_transition_deletion();

COMMIT;
