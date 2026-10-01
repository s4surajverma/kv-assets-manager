-- ============================================================
-- Migration: Soft delete for users + role simplification
-- ============================================================

-- PART 1: Add soft-delete columns to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- PART 2: Role simplification
-- Migrate TeacherInCharge users → StockHolder
UPDATE user_role
SET role_id = (SELECT id FROM role WHERE name = 'StockHolder')
WHERE role_id = (SELECT id FROM role WHERE name = 'TeacherInCharge')
  AND user_id NOT IN (
    SELECT user_id FROM user_role WHERE role_id = (SELECT id FROM role WHERE name = 'StockHolder')
  );

-- Migrate Principal users → Admin
UPDATE user_role
SET role_id = (SELECT id FROM role WHERE name = 'Admin')
WHERE role_id = (SELECT id FROM role WHERE name = 'Principal')
  AND user_id NOT IN (
    SELECT user_id FROM user_role WHERE role_id = (SELECT id FROM role WHERE name = 'Admin')
  );

-- Migrate Auditor users → Admin
UPDATE user_role
SET role_id = (SELECT id FROM role WHERE name = 'Admin')
WHERE role_id = (SELECT id FROM role WHERE name = 'Auditor')
  AND user_id NOT IN (
    SELECT user_id FROM user_role WHERE role_id = (SELECT id FROM role WHERE name = 'Admin')
  );

-- Remove any remaining orphaned role assignments for deleted roles
DELETE FROM user_role WHERE role_id IN (
  SELECT id FROM role WHERE name IN ('TeacherInCharge', 'Principal', 'Auditor')
);

-- Remove the old roles from the role table
DELETE FROM role WHERE name IN ('TeacherInCharge', 'Principal', 'Auditor');
