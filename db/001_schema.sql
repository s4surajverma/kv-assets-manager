-- ============================================================
-- KVS ASSET MANAGEMENT SYSTEM - PRODUCTION SCHEMA
-- PostgreSQL 15+ | Part 1: Tables + Constraints + Indexes
-- ============================================================

BEGIN;

-- ==================== EXTENSIONS ====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== 1. FINANCIAL YEAR ====================
CREATE TABLE financial_year (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(7) NOT NULL UNIQUE,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  is_closed       BOOLEAN DEFAULT false,
  closed_by       INT,
  closed_at       TIMESTAMPTZ,
  depreciation_run BOOLEAN DEFAULT false,
  verification_complete BOOLEAN DEFAULT false,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fy_valid_dates CHECK (end_date > start_date)
);

INSERT INTO financial_year (code, start_date, end_date) VALUES
  ('2024-25', '2024-04-01', '2025-03-31'),
  ('2025-26', '2025-04-01', '2026-03-31'),
  ('2026-27', '2026-04-01', '2027-03-31');

-- ==================== 2. FUNDING HEAD ====================
CREATE TABLE funding_head (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(10) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO funding_head (code, name) VALUES
  ('VVN', 'Vidyalaya Vikas Nidhi'),
  ('SF', 'School Fund'),
  ('PM_SHRI', 'PM SHRI Fund'),
  ('CCA', 'CCA Fund');

-- ==================== 3. ASSET CATEGORY ====================
CREATE TABLE asset_category (
  id                  SERIAL PRIMARY KEY,
  code                VARCHAR(20) NOT NULL UNIQUE,
  name                VARCHAR(100) NOT NULL,
  wdv_rate            DECIMAL(5,4) NOT NULL,
  slm_rate_pre_2011   DECIMAL(5,4),
  slm_rate_post_2011  DECIMAL(5,4),
  residual_pct        DECIMAL(3,2) DEFAULT 0.05,
  is_library          BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_wdv CHECK (wdv_rate > 0 AND wdv_rate <= 1),
  CONSTRAINT valid_residual CHECK (residual_pct >= 0 AND residual_pct < 1)
);

INSERT INTO asset_category (code, name, wdv_rate, slm_rate_pre_2011, slm_rate_post_2011, is_library) VALUES
  ('BUILDING',   'Building',              0.1000, NULL,   NULL,   false),
  ('FURNITURE',  'Furniture & Fixtures',   0.1000, 0.0950, 0.1000, false),
  ('LIBRARY',    'Library Books',          0.1000, 0.0450, 0.1000, true),
  ('OFFICE_EQ',  'Office Equipment',       0.1500, 0.0475, 0.1000, false),
  ('VEHICLE',    'Vehicles',               0.1500, NULL,   NULL,   false),
  ('COMPUTER',   'Computer & Peripherals', 0.2000, 0.1621, 0.2000, false),
  ('HOSTEL',     'Hostel Equipment',       0.1000, NULL,   NULL,   false),
  ('SPORTS',     'Games & Sports',         0.1000, 0.0475, 0.1000, false),
  ('OTHER',      'Other Fixed Assets',     0.1000, 0.0475, 0.1000, false);

-- ==================== 4. DEPARTMENT ====================
CREATE TABLE department (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  category_id INT REFERENCES asset_category(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO department (code, name, category_id) VALUES
  ('COMP',   'Computer Department',     (SELECT id FROM asset_category WHERE code='COMPUTER')),
  ('FURN',   'Furniture',               (SELECT id FROM asset_category WHERE code='FURNITURE')),
  ('LIB',    'Library',                 (SELECT id FROM asset_category WHERE code='LIBRARY')),
  ('OFC_EQ', 'Office Equipment',        (SELECT id FROM asset_category WHERE code='OFFICE_EQ')),
  ('ADV',    'Audio Visual & Music',    (SELECT id FROM asset_category WHERE code='OTHER')),
  ('LAB',    'Lab Equipment',           (SELECT id FROM asset_category WHERE code='OTHER')),
  ('SPORT',  'Sports',                  (SELECT id FROM asset_category WHERE code='SPORTS')),
  ('OFA',    'Other Fixed Assets',      (SELECT id FROM asset_category WHERE code='OTHER'));

-- ==================== 5. LOCATION ====================
CREATE TABLE location (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  building      VARCHAR(100),
  room_number   VARCHAR(50),
  department_id INT REFERENCES department(id),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== 6. SUPPLIER ====================
CREATE TABLE supplier (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  address     TEXT,
  contact     VARCHAR(100),
  gstin       VARCHAR(20),
  pan         VARCHAR(10),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== 7. ROLE ====================
CREATE TABLE role (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO role (name, permissions) VALUES
  ('Admin',           '["*"]'),
  ('Principal',       '["sanction:create","verification:create","condemnation:board_review","fy:close"]'),
  ('StockHolder',     '["stock:create","stock:issue","asset:create","consumable:issue","verification:execute"]'),
  ('TeacherInCharge', '["consumable:attest","condemnation:check"]'),
  ('RegionalOfficer', '["sanction:create","report:all"]'),
  ('Auditor',         '["audit:read","report:all"]');

-- ==================== 8. USER ====================
CREATE TABLE "user" (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  department_id INT REFERENCES department(id),
  designation   VARCHAR(100),
  is_active     BOOLEAN DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== 9. USER_ROLE ====================
CREATE TABLE user_role (
  user_id INT REFERENCES "user"(id) ON DELETE CASCADE,
  role_id INT REFERENCES role(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- ==================== 10. DEPRECIATION RULE ====================
CREATE TABLE depreciation_rule (
  id            SERIAL PRIMARY KEY,
  asset_name    VARCHAR(200) NOT NULL,
  category_id   INT NOT NULL REFERENCES asset_category(id),
  life_years    INT NOT NULL,
  source        VARCHAR(50) DEFAULT 'KVS_APPENDIX_5',
  remarks       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT positive_life CHECK (life_years > 0)
);

-- ==================== 11. STOCK LEDGER (CS-24 / CS-24A) ====================
CREATE TABLE stock_ledger (
  id                SERIAL PRIMARY KEY,
  ledger_type       VARCHAR(6) NOT NULL DEFAULT 'CS24'
                      CHECK (ledger_type IN ('CS24','CS24A')),
  entry_type        VARCHAR(20) NOT NULL
                      CHECK (entry_type IN ('RECEIPT','ISSUE','RETURN','WRITE_OFF','ADJUSTMENT','OPENING')),
  is_consumable     BOOLEAN DEFAULT false,
  funding_head_id   INT NOT NULL REFERENCES funding_head(id),
  department_id     INT NOT NULL REFERENCES department(id),
  financial_year    VARCHAR(7) NOT NULL REFERENCES financial_year(code),
  stock_volume_no   INT,
  stock_page_no     INT,
  entry_date        DATE NOT NULL,

  -- Item
  item_description  TEXT NOT NULL,
  machine_no        VARCHAR(100),
  code_no           VARCHAR(100),

  -- Transaction
  voucher_no        VARCHAR(50),
  cheque_no         VARCHAR(50),
  supplier_id       INT REFERENCES supplier(id),
  bill_no           VARCHAR(50),
  bill_date         DATE,

  -- Quantities
  quantity          DECIMAL(10,2) NOT NULL,
  rate              DECIMAL(12,2),
  amount            DECIMAL(14,2) NOT NULL,
  balance_after     DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Custody
  location_id       INT REFERENCES location(id),
  in_charge_id      INT REFERENCES "user"(id),

  -- Write-off ref
  sanction_no       VARCHAR(50),
  sanction_date     DATE,

  -- Verification
  verified_by       INT REFERENCES "user"(id),
  verified_date     DATE,

  remarks           TEXT,
  created_by        INT NOT NULL REFERENCES "user"(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_amount CHECK (amount >= 0),
  CONSTRAINT no_negative_balance CHECK (balance_after >= 0),
  CONSTRAINT writeoff_needs_sanction CHECK (
    entry_type != 'WRITE_OFF' OR sanction_no IS NOT NULL
  )
);

CREATE INDEX idx_stock_fy ON stock_ledger(financial_year);
CREATE INDEX idx_stock_dept ON stock_ledger(department_id);
CREATE INDEX idx_stock_fund ON stock_ledger(funding_head_id);
CREATE INDEX idx_stock_type ON stock_ledger(ledger_type, entry_type);
CREATE INDEX idx_stock_item ON stock_ledger(item_description, department_id, funding_head_id);
CREATE INDEX idx_stock_page ON stock_ledger(stock_page_no);

-- ==================== 12. ASSET (GFR-22) ====================
CREATE TABLE asset (
  id                  SERIAL PRIMARY KEY,
  asset_number        VARCHAR(50) UNIQUE,
  stock_ledger_id     INT NOT NULL REFERENCES stock_ledger(id),
  funding_head_id     INT NOT NULL REFERENCES funding_head(id),
  department_id       INT NOT NULL REFERENCES department(id),
  category_id         INT NOT NULL REFERENCES asset_category(id),

  -- Details
  name                VARCHAR(300) NOT NULL,
  description         TEXT,
  machine_no          VARCHAR(100),
  accession_no        VARCHAR(50),

  -- Procurement
  purchase_date       DATE NOT NULL,
  voucher_no          VARCHAR(50),
  cheque_no           VARCHAR(50),
  supplier_id         INT REFERENCES supplier(id),
  bill_no             VARCHAR(50),
  bill_date           DATE,
  total_units         INT NOT NULL DEFAULT 1,
  unit_cost           DECIMAL(14,2) NOT NULL,
  total_cost          DECIMAL(14,2) NOT NULL,

  -- Custody
  location_id         INT REFERENCES location(id),
  in_charge_id        INT REFERENCES "user"(id),

  -- Financial
  is_small_value      BOOLEAN DEFAULT false,
  opening_balance     DECIMAL(14,2) DEFAULT 0,
  book_value          DECIMAL(14,2),
  accum_depreciation  DECIMAL(14,2) DEFAULT 0,

  -- Status
  status              VARCHAR(20) DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','CONDEMNED','DISPOSED','TRANSFERRED')),

  -- Life
  useful_life_years   INT,
  depreciation_rule_id INT REFERENCES depreciation_rule(id),

  remarks             TEXT,
  created_by          INT NOT NULL REFERENCES "user"(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT positive_cost CHECK (total_cost >= 0),
  CONSTRAINT positive_units CHECK (total_units > 0),
  CONSTRAINT depr_within_cap CHECK (is_small_value = true OR accum_depreciation <= total_cost * 0.95 + 1)
);

CREATE INDEX idx_asset_status ON asset(status);
CREATE INDEX idx_asset_dept ON asset(department_id);
CREATE INDEX idx_asset_fund ON asset(funding_head_id);
CREATE INDEX idx_asset_category ON asset(category_id);
CREATE INDEX idx_asset_accession ON asset(accession_no) WHERE accession_no IS NOT NULL;
CREATE INDEX idx_asset_stock ON asset(stock_ledger_id);

-- ==================== 13. DEPRECIATION LEDGER ====================
CREATE TABLE depreciation_ledger (
  id                      SERIAL PRIMARY KEY,
  asset_id                INT NOT NULL REFERENCES asset(id),
  financial_year          VARCHAR(7) NOT NULL REFERENCES financial_year(code),
  method                  VARCHAR(5) NOT NULL CHECK (method IN ('WDV','SLM')),
  rate_applied            DECIMAL(5,4) NOT NULL,
  opening_value           DECIMAL(14,2) NOT NULL,
  depreciation_amount     DECIMAL(14,2) NOT NULL,
  closing_value           DECIMAL(14,2) NOT NULL,
  accum_depreciation      DECIMAL(14,2) NOT NULL,
  years_pre_2011          INT DEFAULT 0,
  years_post_2011         INT DEFAULT 0,
  depr_pre_2011           DECIMAL(14,2) DEFAULT 0,
  depr_post_2011          DECIMAL(14,2) DEFAULT 0,
  is_fully_depreciated    BOOLEAN DEFAULT false,
  is_small_value_writeoff BOOLEAN DEFAULT false,
  computed_at             TIMESTAMPTZ DEFAULT NOW(),
  computed_by             INT REFERENCES "user"(id),
  UNIQUE(asset_id, financial_year),
  CONSTRAINT closing_not_negative CHECK (closing_value >= 0),
  CONSTRAINT depr_not_negative CHECK (depreciation_amount >= 0)
);

CREATE INDEX idx_depr_fy ON depreciation_ledger(financial_year);
CREATE INDEX idx_depr_asset ON depreciation_ledger(asset_id);

-- ==================== 14. CONDEMNATION ENTRY (CS-49) ====================
CREATE TABLE condemnation_entry (
  id                    SERIAL PRIMARY KEY,
  condemnation_no       VARCHAR(50) UNIQUE,
  asset_id              INT NOT NULL REFERENCES asset(id),
  stock_page_no         INT,
  funding_head_id       INT NOT NULL REFERENCES funding_head(id),
  department_id         INT NOT NULL REFERENCES department(id),
  financial_year        VARCHAR(7) NOT NULL REFERENCES financial_year(code),
  quantity_condemned     INT NOT NULL DEFAULT 1,
  original_cost         DECIMAL(14,2) NOT NULL,
  total_depreciation    DECIMAL(14,2) NOT NULL,
  cap_95_value          DECIMAL(14,2) NOT NULL,
  condemnation_cost     DECIMAL(14,2) NOT NULL,
  depreciated_value     DECIMAL(14,2) NOT NULL,
  date_unserviceable    DATE,
  reason                TEXT NOT NULL,
  life_period_years     INT,
  model_serial_no       VARCHAR(100),
  board_date            DATE,
  status                VARCHAR(20) DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING','BOARD_REVIEWED','SANCTIONED','REJECTED','DISPOSED')),
  cert_info_correct     BOOLEAN DEFAULT false,
  cert_normal_wear      BOOLEAN DEFAULT false,
  cert_board_report     BOOLEAN DEFAULT false,
  stock_incharge_id     INT REFERENCES "user"(id),
  checker_id            INT REFERENCES "user"(id),
  remarks               TEXT,
  created_by            INT NOT NULL REFERENCES "user"(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_double_condemn UNIQUE (asset_id),
  CONSTRAINT positive_condemned_qty CHECK (quantity_condemned > 0)
);

CREATE INDEX idx_condemn_status ON condemnation_entry(status);
CREATE INDEX idx_condemn_fund ON condemnation_entry(funding_head_id);
CREATE INDEX idx_condemn_fy ON condemnation_entry(financial_year);

-- ==================== 15. SANCTION ====================
CREATE TABLE sanction (
  id                      SERIAL PRIMARY KEY,
  sanction_no             VARCHAR(50) NOT NULL UNIQUE,
  sanction_date           DATE NOT NULL,
  condemnation_id         INT NOT NULL REFERENCES condemnation_entry(id),
  sanctioning_authority   VARCHAR(20) NOT NULL
                            CHECK (sanctioning_authority IN ('PRINCIPAL','VMC','REGIONAL_OFFICER','KVS_HQ')),
  sanctioned_by           INT NOT NULL REFERENCES "user"(id),
  sanctioned_amount       DECIMAL(14,2) NOT NULL,
  financial_year          VARCHAR(7) NOT NULL REFERENCES financial_year(code),
  comments                TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT positive_sanction CHECK (sanctioned_amount > 0)
);

CREATE INDEX idx_sanction_condemn ON sanction(condemnation_id);
CREATE INDEX idx_sanction_fy ON sanction(financial_year);
CREATE INDEX idx_sanction_auth ON sanction(sanctioning_authority, financial_year);

-- ==================== 16. DISPOSAL ====================
CREATE TABLE disposal (
  id                    SERIAL PRIMARY KEY,
  condemnation_id       INT NOT NULL REFERENCES condemnation_entry(id),
  sanction_id           INT NOT NULL REFERENCES sanction(id),
  disposal_mode         VARCHAR(30) NOT NULL
                          CHECK (disposal_mode IN ('ADVERTISED_TENDER','PUBLIC_AUCTION','SCRAP_SALE','DESTRUCTION','TRANSFER','OTHER')),
  disposal_date         DATE NOT NULL,
  buyer_name            VARCHAR(200),
  buyer_address         TEXT,
  reserve_price         DECIMAL(14,2),
  sale_amount           DECIMAL(14,2) DEFAULT 0,
  earnest_money         DECIMAL(14,2),
  payment_received      BOOLEAN DEFAULT false,
  payment_date          DATE,
  is_hazardous          BOOLEAN DEFAULT false,
  recycler_registration VARCHAR(100),
  supervised_by         INT REFERENCES "user"(id),
  remarks               TEXT,
  created_by            INT NOT NULL REFERENCES "user"(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT hazardous_needs_recycler CHECK (
    is_hazardous = false OR recycler_registration IS NOT NULL
  ),
  CONSTRAINT payment_before_release CHECK (
    payment_received = false OR payment_date IS NOT NULL
  )
);

-- ==================== 17. VERIFICATION ====================
CREATE TABLE verification (
  id                SERIAL PRIMARY KEY,
  financial_year    VARCHAR(7) NOT NULL REFERENCES financial_year(code),
  department_id     INT REFERENCES department(id),
  verification_date DATE NOT NULL,
  verified_by       INT NOT NULL REFERENCES "user"(id),
  custodian_id      INT NOT NULL REFERENCES "user"(id),
  status            VARCHAR(25) DEFAULT 'IN_PROGRESS'
                      CHECK (status IN ('IN_PROGRESS','COMPLETED','DISCREPANCIES_FOUND')),
  certificate_text  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(financial_year, department_id)
);

CREATE TABLE verification_item (
  id                SERIAL PRIMARY KEY,
  verification_id   INT NOT NULL REFERENCES verification(id) ON DELETE CASCADE,
  asset_id          INT NOT NULL REFERENCES asset(id),
  stock_qty         INT NOT NULL,
  physical_qty      INT NOT NULL,
  discrepancy       INT GENERATED ALWAYS AS (physical_qty - stock_qty) STORED,
  condition         VARCHAR(20)
                      CHECK (condition IN ('GOOD','FAIR','DAMAGED','UNSERVICEABLE','MISSING')),
  remarks           TEXT,
  CONSTRAINT non_negative_qty CHECK (stock_qty >= 0 AND physical_qty >= 0)
);

CREATE INDEX idx_verif_fy ON verification(financial_year);
CREATE INDEX idx_verif_dept ON verification(department_id);

-- ==================== 18. CONSUMABLE ISSUE (CS-24A) ====================
CREATE TABLE consumable_issue (
  id              SERIAL PRIMARY KEY,
  stock_ledger_id INT NOT NULL REFERENCES stock_ledger(id),
  issued_to       INT NOT NULL REFERENCES "user"(id),
  issued_by       INT NOT NULL REFERENCES "user"(id),
  issue_date      DATE NOT NULL,
  quantity        DECIMAL(10,2) NOT NULL,
  purpose         TEXT NOT NULL,
  attested_by     INT REFERENCES "user"(id),
  returned_qty    DECIMAL(10,2) DEFAULT 0,
  return_date     DATE,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT positive_issue_qty CHECK (quantity > 0),
  CONSTRAINT valid_return CHECK (returned_qty >= 0 AND returned_qty <= quantity)
);

CREATE INDEX idx_consumable_stock ON consumable_issue(stock_ledger_id);
CREATE INDEX idx_consumable_date ON consumable_issue(issue_date);

-- ==================== 19. AUDIT LOG ====================
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  table_name  VARCHAR(50) NOT NULL,
  record_id   INT NOT NULL,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_values  JSONB,
  new_values  JSONB,
  changed_by  INT NOT NULL,
  changed_at  TIMESTAMPTZ DEFAULT NOW(),
  ip_address  INET
);

CREATE INDEX idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_time ON audit_log(changed_at);
CREATE INDEX idx_audit_user ON audit_log(changed_by);

-- Partition by year for performance
-- CREATE TABLE audit_log_2025 PARTITION OF audit_log FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

COMMIT;
