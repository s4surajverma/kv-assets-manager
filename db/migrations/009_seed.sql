-- ============================================================
-- 008: SEED DATA ARCHITECTURE (LOCAL DEVELOPMENT ONLY)
-- Replaces the legacy 003_seed.sql with fully tenant-aware,
-- module-compatible, realistic workflow data.
-- ============================================================

BEGIN;

-- ==================== 1. MULTI-TENANT SETUP ====================
-- Add additional tenants (id 1 is reserved for SYSTEM)
INSERT INTO vidyalaya (id, kv_code, kv_name_en, kv_name_hi, regional_office_en, regional_office_hi, status, is_active, is_system) VALUES
  (2, 'KVAUR', 'Kendriya Vidyalaya Aurangabad', 'केन्द्रीय विद्यालय औरंगाबाद', 'Patna', 'पटना', 'APPROVED', true, false),
  (3, 'KVPAT', 'Kendriya Vidyalaya Patna', 'केन्द्रीय विद्यालय पटना', 'Patna', 'पटना', 'APPROVED', true, false),
  (4, 'KVDAN', 'Kendriya Vidyalaya Danapur', 'केन्द्रीय विद्यालय दानापुर', 'Patna', 'पटना', 'PENDING', false, false)
ON CONFLICT (id) DO NOTHING;

SELECT setval('vidyalaya_id_seq', (SELECT MAX(id) FROM vidyalaya));

-- ==================== 2. USERS (KV Aurangabad - vidyalaya_id=2) ====================
-- Password for all test users: "test1234"
INSERT INTO "user" (id, name, email, employee_code, password_hash, designation, vidyalaya_id, is_active) VALUES
  (1, 'System Admin',       'admin@kvs.gov.in',    'EMP001', '$2a$12$34sBhKD2x8DhDlXgcOMOueAYOxxo8u83ZDpK.jkqATcOwHv7IXqTq', 'Administrator', 2, true),
  (2, 'Dr. Rajesh Kumar',   'principal@kvs.gov.in','EMP002', '$2a$12$34sBhKD2x8DhDlXgcOMOueAYOxxo8u83ZDpK.jkqATcOwHv7IXqTq', 'Principal', 2, true),
  (3, 'Suresh Sharma',      'comp@kvs.gov.in',     'EMP003', '$2a$12$34sBhKD2x8DhDlXgcOMOueAYOxxo8u83ZDpK.jkqATcOwHv7IXqTq', 'PGT Computer Science', 2, true),
  (4, 'Anita Verma',        'science@kvs.gov.in',  'EMP004', '$2a$12$34sBhKD2x8DhDlXgcOMOueAYOxxo8u83ZDpK.jkqATcOwHv7IXqTq', 'PGT Physics', 2, true),
  (5, 'Rahul Gupta',        'office@kvs.gov.in',   'EMP005', '$2a$12$34sBhKD2x8DhDlXgcOMOueAYOxxo8u83ZDpK.jkqATcOwHv7IXqTq', 'Head Clerk', 2, true),
  (6, 'Neha Singh',         'lib@kvs.gov.in',      'EMP006', '$2a$12$34sBhKD2x8DhDlXgcOMOueAYOxxo8u83ZDpK.jkqATcOwHv7IXqTq', 'Librarian', 2, true),
  (7, 'Regional Officer',   'ro@kvs.gov.in',       'EMP007', '$2a$12$34sBhKD2x8DhDlXgcOMOueAYOxxo8u83ZDpK.jkqATcOwHv7IXqTq', 'Regional Officer', 2, true)
ON CONFLICT (id) DO NOTHING;

SELECT setval('user_id_seq', (SELECT MAX(id) FROM "user"));

-- Roles: 1=Admin, 3=StockHolder, 5=RegionalOfficer (from 001_schema + 004_user_delete_roles logic)
-- Note: Principal and Auditor roles were removed, so we map them to Admin or StockHolder as appropriate
INSERT INTO user_role (user_id, role_id) VALUES
  (1, (SELECT id FROM role WHERE name='Admin')),
  (2, (SELECT id FROM role WHERE name='Admin')),
  (3, (SELECT id FROM role WHERE name='StockHolder')),
  (4, (SELECT id FROM role WHERE name='StockHolder')),
  (5, (SELECT id FROM role WHERE name='StockHolder')),
  (6, (SELECT id FROM role WHERE name='StockHolder')),
  (7, (SELECT id FROM role WHERE name='RegionalOfficer'))
ON CONFLICT DO NOTHING;

-- ==================== 3. OPERATIONAL DEPARTMENTS (KV Aurangabad) ====================
INSERT INTO operational_department (id, code, name, incharge_id, vidyalaya_id) VALUES
  (1, 'COMP_LAB', 'Computer Lab', 3, 2),
  (2, 'SCI_LAB',  'Science Lab',  4, 2),
  (3, 'MAIN_OFC', 'Main Office',  5, 2),
  (4, 'LIBRARY',  'Library',      6, 2),
  (5, 'EXAM_CELL','Examination Cell', NULL, 2) -- Vacant for testing assignment
ON CONFLICT (id) DO NOTHING;

SELECT setval('operational_department_id_seq', (SELECT MAX(id) FROM operational_department));

-- Update users to point to their operational departments
UPDATE "user" SET operational_department_id = 1 WHERE id = 3;
UPDATE "user" SET operational_department_id = 2 WHERE id = 4;
UPDATE "user" SET operational_department_id = 3 WHERE id = 5;
UPDATE "user" SET operational_department_id = 4 WHERE id = 6;

-- ==================== 4. LOCATIONS ====================
INSERT INTO location (id, name, building, room_number, department_id, vidyalaya_id) VALUES
  (1, 'Main Computer Lab', 'IT Block',     '101', 1, 2),
  (2, 'Physics Lab',       'Science Block','201', 6, 2),
  (3, 'Clerk Office',      'Admin Block',  '001', 4, 2),
  (4, 'Main Library',      'Library Block','101', 3, 2)
ON CONFLICT (id) DO NOTHING;

SELECT setval('location_id_seq', (SELECT MAX(id) FROM location));

-- ==================== 5. SUPPLIERS ====================
INSERT INTO supplier (id, name, address, contact, gstin, vidyalaya_id) VALUES
  (1, 'Dell India Pvt. Ltd.',    'Hyderabad, TS', '040-12345678', '36AABCD1234E1ZV', 2),
  (2, 'Godrej Interio',          'Mumbai, MH',    '022-87654321', '27AABCG5678F1Z2', 2),
  (3, 'Scientific Corp India',   'Delhi, DL',     '011-23456789', '07AACCS3456D1Z1', 2),
  (4, 'Navneet Publications',    'Ahmedabad, GJ', '079-98765432', '24AAACN9012G1Z3', 2)
ON CONFLICT (id) DO NOTHING;

SELECT setval('supplier_id_seq', (SELECT MAX(id) FROM supplier));

-- ==================== 6. DEPRECIATION RULES (Global) ====================
INSERT INTO depreciation_rule (id, asset_name, category_id, life_years) VALUES
  (1, 'Desktop Computer',     (SELECT id FROM asset_category WHERE code='COMPUTER'),  5),
  (2, 'Laptop',               (SELECT id FROM asset_category WHERE code='COMPUTER'),  5),
  (3, 'Printer',              (SELECT id FROM asset_category WHERE code='COMPUTER'),  5),
  (4, 'Steel Almirah',        (SELECT id FROM asset_category WHERE code='FURNITURE'), 15),
  (5, 'Wooden Table',         (SELECT id FROM asset_category WHERE code='FURNITURE'), 10),
  (6, 'Physics Equipment',    (SELECT id FROM asset_category WHERE code='OTHER'),     10),
  (7, 'Library Books',        (SELECT id FROM asset_category WHERE code='LIBRARY'),   10),
  (8, 'Air Conditioner',      (SELECT id FROM asset_category WHERE code='OFFICE_EQ'), 10),
  (9, 'Photocopier',          (SELECT id FROM asset_category WHERE code='OFFICE_EQ'), 7)
ON CONFLICT (id) DO NOTHING;

SELECT setval('depreciation_rule_id_seq', (SELECT MAX(id) FROM depreciation_rule));

-- ==================== 7. STOCK LEDGER (CS-24) ====================
-- Disable trigger temporarily to allow historical dates without FY locks
ALTER TABLE stock_ledger DISABLE TRIGGER trg_fy_lock_stock;

INSERT INTO stock_ledger (id, ledger_type, entry_type, funding_head_id, department_id, operational_department_id, financial_year, entry_date, item_description, voucher_no, supplier_id, bill_no, bill_date, quantity, rate, amount, location_id, created_by, vidyalaya_id, stock_volume_no, stock_page_no) VALUES
  -- Computer Lab (VVN) - Asset Head: COMPUTER
  (1, 'CS24', 'RECEIPT', 1, 1, 1, '2024-25', '2024-05-15', 'Dell OptiPlex 7010 Desktop', 'VVN/24/001', 1, 'B-101', '2024-05-10', 10, 45000, 450000, 1, 3, 2, 1, 1),
  (2, 'CS24', 'RECEIPT', 1, 1, 1, '2024-25', '2024-06-20', 'HP LaserJet M404dn Printer', 'VVN/24/002', 1, 'B-102', '2024-06-15', 2, 25000, 50000, 1, 3, 2, 1, 2),
  
  -- Science Lab (VVN) - Asset Head: LAB
  (3, 'CS24', 'RECEIPT', 1, 6, 2, '2024-25', '2024-07-10', 'Digital Oscilloscope',       'VVN/24/003', 3, 'S-501', '2024-07-05', 5, 15000, 75000, 2, 4, 2, 2, 1),
  
  -- Main Office (SF) - Asset Head: OFC_EQ
  (4, 'CS24', 'RECEIPT', 2, 4, 3, '2024-25', '2024-08-05', 'Canon Photocopier IR-2006',  'SF/24/001',  1, 'B-205', '2024-08-01', 1, 85000, 85000, 3, 5, 2, 3, 1),
  
  -- Main Office (SF) - Asset Head: FURN
  (5, 'CS24', 'RECEIPT', 2, 2, 3, '2024-25', '2024-08-10', 'Godrej Steel Almirah',       'SF/24/002',  2, 'G-301', '2024-08-05', 4, 12000, 48000, 3, 5, 2, 3, 2),
  
  -- Small Value Item (VVN)
  (6, 'CS24', 'RECEIPT', 1, 8, 3, '2024-25', '2024-09-15', 'Ajanta Wall Clock',          'VVN/24/005', 2, 'G-302', '2024-09-10', 5, 450, 2250, 3, 5, 2, 3, 3),

  -- Library (VVN) - Asset Head: LIB
  (7, 'CS24', 'RECEIPT', 1, 3, 4, '2025-26', '2025-04-10', 'Reference Books (Science)',  'VVN/25/001', 4, 'N-101', '2025-04-05', 50, 500, 25000, 4, 6, 2, 4, 1)
ON CONFLICT (id) DO NOTHING;

SELECT setval('stock_ledger_id_seq', (SELECT MAX(id) FROM stock_ledger));
ALTER TABLE stock_ledger ENABLE TRIGGER trg_fy_lock_stock;

-- ==================== 8. ASSETS (GFR-22) ====================
INSERT INTO asset (id, asset_number, stock_ledger_id, funding_head_id, department_id, operational_department_id, category_id, name, purchase_date, voucher_no, supplier_id, total_units, unit_cost, total_cost, location_id, depreciation_rule_id, created_by, vidyalaya_id, asset_classification) VALUES
  -- Computers
  (1, 'KVS-COMP-2024-25-0001', 1, 1, 1, 1, (SELECT id FROM asset_category WHERE code='COMPUTER'), 'Dell OptiPlex 7010', '2024-05-15', 'VVN/24/001', 1, 10, 45000, 450000, 1, 1, 3, 2, 'CAPITAL'),
  (2, 'KVS-COMP-2024-25-0002', 2, 1, 1, 1, (SELECT id FROM asset_category WHERE code='COMPUTER'), 'HP LaserJet M404dn', '2024-06-20', 'VVN/24/002', 1, 2, 25000, 50000, 1, 3, 3, 2, 'CAPITAL'),
  
  -- Science Lab
  (3, 'KVS-LAB-2024-25-0001',  3, 1, 6, 2, (SELECT id FROM asset_category WHERE code='OTHER'),    'Digital Oscilloscope','2024-07-10', 'VVN/24/003', 3, 5, 15000, 75000, 2, 6, 4, 2, 'CAPITAL'),
  
  -- Office
  (4, 'KVS-OFC_EQ-2024-25-001',4, 2, 4, 3, (SELECT id FROM asset_category WHERE code='OFFICE_EQ'),'Canon Photocopier',   '2024-08-05', 'SF/24/001',  1, 1, 85000, 85000, 3, 9, 5, 2, 'CAPITAL'),
  (5, 'KVS-FURN-2024-25-0001', 5, 2, 2, 3, (SELECT id FROM asset_category WHERE code='FURNITURE'),'Godrej Steel Almirah','2024-08-10', 'SF/24/002',  2, 4, 12000, 48000, 3, 4, 5, 2, 'CAPITAL'),
  (6, 'KVS-OFA-2024-25-0001',  6, 1, 8, 3, (SELECT id FROM asset_category WHERE code='OTHER'),    'Ajanta Wall Clock',   '2024-09-15', 'VVN/24/005', 2, 5, 450, 2250, 3, NULL, 5, 2, 'REVENUE'),

  -- Library
  (7, 'KVS-LIB-2025-26-0001',  7, 1, 3, 4, (SELECT id FROM asset_category WHERE code='LIBRARY'),  'Science Ref Books',   '2025-04-10', 'VVN/25/001', 4, 50, 500, 25000, 4, 7, 6, 2, 'CAPITAL')
ON CONFLICT (id) DO NOTHING;

SELECT setval('asset_id_seq', (SELECT MAX(id) FROM asset));

-- Update small value flags and initial book values
UPDATE asset SET is_small_value = true, book_value = 0, accum_depreciation = total_cost WHERE unit_cost <= 2000 AND category_id != (SELECT id FROM asset_category WHERE code='LIBRARY');
UPDATE asset SET is_small_value = false, book_value = total_cost, accum_depreciation = 0 WHERE book_value IS NULL;

-- ==================== 9. DEPRECIATION LEDGER (FY 24-25 Run) ====================
ALTER TABLE depreciation_ledger DISABLE TRIGGER trg_fy_lock_depr;

INSERT INTO depreciation_ledger (asset_id, financial_year, method, rate_applied, opening_value, depreciation_amount, closing_value, accum_depreciation, computed_by, vidyalaya_id) VALUES
  (1, '2024-25', 'WDV', 0.2000, 450000, 90000, 360000, 90000, 1, 2),
  (2, '2024-25', 'WDV', 0.2000, 50000,  10000, 40000,  10000, 1, 2),
  (3, '2024-25', 'WDV', 0.1000, 75000,  7500,  67500,  7500,  1, 2),
  (4, '2024-25', 'WDV', 0.1500, 85000,  12750, 72250,  12750, 1, 2),
  (5, '2024-25', 'WDV', 0.1000, 48000,  4800,  43200,  4800,  1, 2)
ON CONFLICT DO NOTHING;

ALTER TABLE depreciation_ledger ENABLE TRIGGER trg_fy_lock_depr;

-- Sync asset book values
UPDATE asset SET book_value = 360000, accum_depreciation = 90000 WHERE id = 1;
UPDATE asset SET book_value = 40000, accum_depreciation = 10000 WHERE id = 2;
UPDATE asset SET book_value = 67500, accum_depreciation = 7500 WHERE id = 3;
UPDATE asset SET book_value = 72250, accum_depreciation = 12750 WHERE id = 4;
UPDATE asset SET book_value = 43200, accum_depreciation = 4800 WHERE id = 5;

UPDATE financial_year SET depreciation_run = true WHERE code = '2024-25';

-- ==================== 10. VERIFICATION ====================
INSERT INTO verification (id, financial_year, operational_department_id, verification_date, verified_by, custodian_id, status, vidyalaya_id) VALUES
  (1, '2024-25', 1, '2025-03-15', 2, 3, 'COMPLETED', 2), -- Computer lab verified by Principal
  (2, '2025-26', 2, '2025-05-10', 2, 4, 'IN_PROGRESS', 2) -- Science lab ongoing
ON CONFLICT DO NOTHING;

SELECT setval('verification_id_seq', (SELECT MAX(id) FROM verification));

INSERT INTO verification_item (verification_id, asset_id, stock_qty, physical_qty, condition, remarks) VALUES
  (1, 1, 10, 10, 'GOOD', 'All PCs working'),
  (1, 2, 2, 1, 'MISSING', 'One printer missing, under investigation'),
  (2, 3, 5, 5, 'GOOD', NULL)
ON CONFLICT DO NOTHING;

-- ==================== 11. CONDEMNATION ====================
-- Legacy Condemnation (Single-asset) - Status: SANCTIONED
ALTER TABLE condemnation_entry DISABLE TRIGGER trg_fy_lock_condemn;
INSERT INTO condemnation_entry (id, condemnation_no, asset_id, funding_head_id, department_id, financial_year, original_cost, total_depreciation, cap_95_value, condemnation_cost, depreciated_value, reason, status, created_by, vidyalaya_id) VALUES
  (1, 'COND/24/001', 5, 2, 2, '2024-25', 48000, 4800, 45600, 43200, 4800, 'Almirah severely rusted', 'SANCTIONED', 5, 2)
ON CONFLICT DO NOTHING;
ALTER TABLE condemnation_entry ENABLE TRIGGER trg_fy_lock_condemn;

INSERT INTO sanction (id, sanction_no, sanction_date, condemnation_id, sanctioning_authority, sanctioned_by, sanctioned_amount, financial_year, vidyalaya_id) VALUES
  (1, 'SANC/24/001', '2025-01-10', 1, 'VMC', 2, 43200, '2024-25', 2)
ON CONFLICT DO NOTHING;

UPDATE asset SET status = 'CONDEMNED' WHERE id = 5;

-- New Condemnation Master (Multi-asset) - Status: BOARD_REVIEWED
INSERT INTO condemnation_master (id, vidyalaya_id, operational_department_id, funding_head_id, financial_year, reason, board_date, status, cert_info_correct, cert_normal_wear, cert_board_report, stock_incharge_id, created_by, total_original_cost, total_depreciation, total_condemnation_cost, total_depreciated_value) VALUES
  (1, 2, 1, 1, '2025-26', 'Obsolete computers, beyond repair', '2025-05-01', 'BOARD_REVIEWED', true, true, true, 3, 3, 225000, 45000, 180000, 45000)
ON CONFLICT DO NOTHING;

SELECT setval('condemnation_master_id_seq', (SELECT MAX(id) FROM condemnation_master));

INSERT INTO condemnation_items (condemnation_master_id, asset_id, department_id, quantity_condemned, original_cost, total_depreciation, cap_95_value, condemnation_cost, depreciated_value) VALUES
  (1, 1, 1, 5, 225000, 45000, 213750, 180000, 45000) -- Condemning 5 out of 10 PCs
ON CONFLICT DO NOTHING;

UPDATE asset SET status = 'UNDER_CONDEMNATION' WHERE id = 1;

-- ==================== 12. STOCK CHARGE TRANSFER ====================
INSERT INTO stock_transition_master (id, vidyalaya_id, operational_department_id, handed_over_by_user_id, taken_over_by_user_id, handed_over_by_name, taken_over_by_name, status, transition_date, total_items, verified_items, discrepancy_count, initiated_by) VALUES
  -- Completed transfer for Main Office
  (1, 2, 3, 1, 5, 'System Admin', 'Rahul Gupta', 'COMPLETED', '2024-10-01', 3, 3, 0, 1),
  -- Under verification transfer for Science Lab
  (2, 2, 2, 4, 1, 'Anita Verma', 'System Admin', 'UNDER_VERIFICATION', '2025-05-15', 1, 1, 0, 4)
ON CONFLICT DO NOTHING;

SELECT setval('stock_transition_master_id_seq', (SELECT MAX(id) FROM stock_transition_master));

INSERT INTO stock_transition_items (transition_master_id, asset_id, asset_number, asset_name, quantity_system, quantity_verified, condition_status, asset_head_id, funding_head_id, asset_classification) VALUES
  (1, 4, 'KVS-OFC_EQ-2024-25-001', 'Canon Photocopier', 1, 1, 'GOOD', 4, 2, 'CAPITAL'),
  (1, 5, 'KVS-FURN-2024-25-0001', 'Godrej Steel Almirah', 4, 4, 'GOOD', 2, 2, 'CAPITAL'),
  (1, 6, 'KVS-OFA-2024-25-0001', 'Ajanta Wall Clock', 5, 5, 'GOOD', 8, 1, 'REVENUE'),
  (2, 3, 'KVS-LAB-2024-25-0001', 'Digital Oscilloscope', 5, 5, 'GOOD', 6, 1, 'CAPITAL')
ON CONFLICT DO NOTHING;

-- ==================== 13. AUDIT LOGS ====================
INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, vidyalaya_id) VALUES
  ('vidyalaya', 2, 'UPDATE', '{"status":"APPROVED"}', 1, 2),
  ('asset', 1, 'INSERT', '{"asset_number":"KVS-COMP-2024-25-0001"}', 3, 2),
  ('stock_transition_master', 1, 'UPDATE', '{"status":"COMPLETED"}', 1, 2);

-- ==================== SUMMARY ====================
DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE '  SEED DATA ARCHITECTURE LOADED SUCCESSFULLY';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '';
  RAISE NOTICE '  Tenant:     Kendriya Vidyalaya Aurangabad (System)';
  RAISE NOTICE '  Password:   test1234 (For all users below)';
  RAISE NOTICE '  -----------------------------------';
  RAISE NOTICE '  Admin:      EMP001 (admin@kvs.gov.in)';
  RAISE NOTICE '  Principal:  EMP002 (principal@kvs.gov.in)';
  RAISE NOTICE '  Comp Lab:   EMP003 (comp@kvs.gov.in)';
  RAISE NOTICE '  Sci Lab:    EMP004 (science@kvs.gov.in)';
  RAISE NOTICE '  Office:     EMP005 (office@kvs.gov.in)';
  RAISE NOTICE '  Library:    EMP006 (lib@kvs.gov.in)';
  RAISE NOTICE '  RO:         EMP007 (ro@kvs.gov.in)';
  RAISE NOTICE '=============================================';
END $$;

COMMIT;
