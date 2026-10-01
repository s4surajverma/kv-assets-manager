-- ============================================================
-- 011: Non-Consumable Custody Management — Schema & Safeguards
-- ============================================================
-- Phase 1 of the Non-Consumable Issue/Return Tracking Module.
--
-- Creates:
--   1. non_consumable_issue_master  — Transaction-level custody record
--   2. non_consumable_issue_items   — Item-level movement with snapshots
--   3. Asset table helpers          — Derived operational state fields
--   4. DB triggers                  — Immutability + status transition safety
--   5. Indexes                      — Overdue tracking + performance
-- ============================================================

BEGIN;


-- ────────────────────────────────────────────────────────────
-- 1. NON-CONSUMABLE ISSUE MASTER
-- ────────────────────────────────────────────────────────────
-- Authoritative transaction record for custody movements.
-- One row per "issue event" (may cover multiple assets).

CREATE TABLE IF NOT EXISTS non_consumable_issue_master (
  id                        SERIAL PRIMARY KEY,
  vidyalaya_id              INT NOT NULL REFERENCES vidyalaya(id) ON DELETE RESTRICT,

  -- Issue identification
  issue_no                  VARCHAR(50) NOT NULL,
  movement_sequence_no      INT NOT NULL,

  -- Who / Where
  issued_by_user_id         INT NOT NULL REFERENCES "user"(id),
  issued_from_department_id INT NOT NULL REFERENCES operational_department(id),

  -- Target
  issue_target_type         VARCHAR(20) NOT NULL
                              CHECK (issue_target_type IN ('DEPARTMENT', 'USER')),
  issued_to_department_id   INT REFERENCES operational_department(id),
  issued_to_user_id         INT REFERENCES "user"(id),

  -- Purpose & timing
  issue_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  purpose                   TEXT NOT NULL,
  expected_return_date      DATE,

  -- Status lifecycle
  status                    VARCHAR(25) NOT NULL DEFAULT 'ISSUED'
                              CHECK (status IN ('ISSUED', 'PARTIALLY_RETURNED', 'RETURNED', 'CANCELLED')),

  -- Timestamps for finalization
  returned_at               TIMESTAMPTZ,
  cancelled_at              TIMESTAMPTZ,

  -- Future-safe document references (optional)
  office_order_no           VARCHAR(100),
  approval_reference        VARCHAR(100),
  hand_receipt_no           VARCHAR(100),

  -- Audit
  remarks                   TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT nc_issue_no_unique_per_tenant UNIQUE (vidyalaya_id, issue_no),
  CONSTRAINT nc_movement_seq_unique UNIQUE (vidyalaya_id, movement_sequence_no),
  CONSTRAINT nc_target_dept_required CHECK (
    issue_target_type != 'DEPARTMENT' OR issued_to_department_id IS NOT NULL
  ),
  CONSTRAINT nc_target_user_required CHECK (
    issue_target_type != 'USER' OR issued_to_user_id IS NOT NULL
  ),
  CONSTRAINT nc_returned_timestamp CHECK (
    status != 'RETURNED' OR returned_at IS NOT NULL
  ),
  CONSTRAINT nc_cancelled_timestamp CHECK (
    status != 'CANCELLED' OR cancelled_at IS NOT NULL
  )
);


-- ────────────────────────────────────────────────────────────
-- 2. NON-CONSUMABLE ISSUE ITEMS
-- ────────────────────────────────────────────────────────────
-- Item-level movement records with immutable snapshots.
-- Each row tracks one asset within a custody event.

CREATE TABLE IF NOT EXISTS non_consumable_issue_items (
  id                      SERIAL PRIMARY KEY,
  issue_master_id         INT NOT NULL REFERENCES non_consumable_issue_master(id) ON DELETE RESTRICT,
  asset_id                INT NOT NULL REFERENCES asset(id),

  -- Asset type distinction
  movement_asset_type     VARCHAR(15) NOT NULL DEFAULT 'SERIALIZED'
                            CHECK (movement_asset_type IN ('SERIALIZED', 'BULK')),

  -- Quantities
  quantity_issued         INT NOT NULL DEFAULT 1,
  quantity_returned       INT NOT NULL DEFAULT 0,

  -- Condition tracking
  condition_at_issue      VARCHAR(30) NOT NULL DEFAULT 'GOOD'
                            CHECK (condition_at_issue IN ('GOOD', 'FAIR', 'DAMAGED', 'UNSERVICEABLE')),
  condition_at_return     VARCHAR(30)
                            CHECK (condition_at_return IS NULL OR condition_at_return IN ('GOOD', 'FAIR', 'DAMAGED', 'UNSERVICEABLE')),

  -- Immutable snapshots (frozen at issue time)
  asset_name_snapshot     VARCHAR(300) NOT NULL,
  asset_number_snapshot   VARCHAR(50),
  issued_from_snapshot    VARCHAR(100) NOT NULL,
  target_name_snapshot    VARCHAR(200) NOT NULL,

  -- Return remarks (separate from master remarks)
  return_remarks          TEXT,

  created_at              TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT nc_item_positive_qty CHECK (quantity_issued > 0),
  CONSTRAINT nc_item_return_cap CHECK (quantity_returned >= 0 AND quantity_returned <= quantity_issued),
  CONSTRAINT nc_serialized_single_unit CHECK (
    movement_asset_type != 'SERIALIZED' OR quantity_issued = 1
  )
);


-- ────────────────────────────────────────────────────────────
-- 3. ASSET TABLE — Derived operational custody helpers
-- ────────────────────────────────────────────────────────────
-- These are DERIVED state fields for dashboard performance.
-- The authoritative source of truth is always the movement tables.

ALTER TABLE asset
  ADD COLUMN IF NOT EXISTS total_issued_quantity INT NOT NULL DEFAULT 0;

ALTER TABLE asset
  ADD COLUMN IF NOT EXISTS last_movement_at TIMESTAMPTZ;


-- ────────────────────────────────────────────────────────────
-- 4. TRIGGER: Immutability for finalized movements
-- ────────────────────────────────────────────────────────────
-- Prevents any modification to RETURNED or CANCELLED records.

CREATE OR REPLACE FUNCTION nc_enforce_finalized_immutability() RETURNS TRIGGER AS $$
BEGIN
  -- Block updates to records already in terminal state
  IF OLD.status IN ('RETURNED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Non-consumable issue % is finalized (status=%). No modifications allowed.',
      OLD.issue_no, OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nc_master_immutability ON non_consumable_issue_master;
CREATE TRIGGER trg_nc_master_immutability
  BEFORE UPDATE ON non_consumable_issue_master
  FOR EACH ROW EXECUTE FUNCTION nc_enforce_finalized_immutability();


-- ────────────────────────────────────────────────────────────
-- 5. TRIGGER: Status transition validation
-- ────────────────────────────────────────────────────────────
-- Enforces: ISSUED -> PARTIALLY_RETURNED -> RETURNED
--           ISSUED -> CANCELLED (only if nothing returned)

CREATE OR REPLACE FUNCTION nc_enforce_status_transition() RETURNS TRIGGER AS $$
DECLARE
  total_returned INT;
BEGIN
  -- Allow no-change updates (e.g. updating remarks on ISSUED)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- ISSUED -> PARTIALLY_RETURNED: OK
  IF OLD.status = 'ISSUED' AND NEW.status = 'PARTIALLY_RETURNED' THEN
    RETURN NEW;
  END IF;

  -- ISSUED -> CANCELLED: only if nothing returned
  IF OLD.status = 'ISSUED' AND NEW.status = 'CANCELLED' THEN
    SELECT COALESCE(SUM(quantity_returned), 0) INTO total_returned
      FROM non_consumable_issue_items WHERE issue_master_id = OLD.id;
    IF total_returned > 0 THEN
      RAISE EXCEPTION 'Cannot cancel issue % — % items already returned.',
        OLD.issue_no, total_returned;
    END IF;
    RETURN NEW;
  END IF;

  -- ISSUED -> RETURNED: OK (direct full return)
  IF OLD.status = 'ISSUED' AND NEW.status = 'RETURNED' THEN
    RETURN NEW;
  END IF;

  -- PARTIALLY_RETURNED -> RETURNED: OK
  IF OLD.status = 'PARTIALLY_RETURNED' AND NEW.status = 'RETURNED' THEN
    RETURN NEW;
  END IF;

  -- All other transitions are invalid
  RAISE EXCEPTION 'Invalid status transition: % -> % for issue %',
    OLD.status, NEW.status, OLD.issue_no;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nc_status_transition ON non_consumable_issue_master;
CREATE TRIGGER trg_nc_status_transition
  BEFORE UPDATE ON non_consumable_issue_master
  FOR EACH ROW EXECUTE FUNCTION nc_enforce_status_transition();


-- ────────────────────────────────────────────────────────────
-- 6. TRIGGER: Prevent item modification on finalized master
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION nc_enforce_item_immutability() RETURNS TRIGGER AS $$
DECLARE
  master_status VARCHAR(25);
BEGIN
  SELECT status INTO master_status
    FROM non_consumable_issue_master WHERE id = OLD.issue_master_id;

  IF master_status IN ('RETURNED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Cannot modify items on finalized issue (status=%).',
      master_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nc_item_immutability ON non_consumable_issue_items;
CREATE TRIGGER trg_nc_item_immutability
  BEFORE UPDATE ON non_consumable_issue_items
  FOR EACH ROW EXECUTE FUNCTION nc_enforce_item_immutability();


-- ────────────────────────────────────────────────────────────
-- 7. INDEXES — Performance for overdue tracking & lookups
-- ────────────────────────────────────────────────────────────

-- Tenant isolation
CREATE INDEX IF NOT EXISTS idx_nc_master_vidyalaya
  ON non_consumable_issue_master(vidyalaya_id);

-- Status filtering (active issues dashboard)
CREATE INDEX IF NOT EXISTS idx_nc_master_status
  ON non_consumable_issue_master(status);

-- Overdue detection: dynamic query on (expected_return_date, status, vidyalaya_id)
CREATE INDEX IF NOT EXISTS idx_nc_master_overdue
  ON non_consumable_issue_master(vidyalaya_id, expected_return_date, status)
  WHERE status IN ('ISSUED', 'PARTIALLY_RETURNED');

-- Department lookups
CREATE INDEX IF NOT EXISTS idx_nc_master_from_dept
  ON non_consumable_issue_master(issued_from_department_id);

CREATE INDEX IF NOT EXISTS idx_nc_master_to_dept
  ON non_consumable_issue_master(issued_to_department_id)
  WHERE issued_to_department_id IS NOT NULL;

-- Item-level lookups
CREATE INDEX IF NOT EXISTS idx_nc_items_master
  ON non_consumable_issue_items(issue_master_id);

CREATE INDEX IF NOT EXISTS idx_nc_items_asset
  ON non_consumable_issue_items(asset_id);

-- Asset table: movement recency
CREATE INDEX IF NOT EXISTS idx_asset_last_movement
  ON asset(last_movement_at)
  WHERE last_movement_at IS NOT NULL;

-- Asset table: issued quantity filtering
CREATE INDEX IF NOT EXISTS idx_asset_issued_qty
  ON asset(total_issued_quantity)
  WHERE total_issued_quantity > 0;


COMMIT;
