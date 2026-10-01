const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const authorize = require('../middleware/rbac');
const db = require('../config/db');
const { success, created, error } = require('../utils/responseHelper');

// GET /api/v1/users
router.get('/', authorize('Admin'), async (req, res, next) => {
  try {
    const vid = req.user.vidyalaya_id;
    const { operational_dept_id, role } = req.query;
    let sql = `SELECT u.id, u.name, u.email, u.employee_code, u.operational_department_id, u.designation, u.is_active, u.last_login,
                      ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL) AS roles
               FROM "user" u
               LEFT JOIN user_role ur ON ur.user_id = u.id
               LEFT JOIN role r ON r.id = ur.role_id`;
    const params = [vid];
    const where = ['u.vidyalaya_id = $1', 'u.is_deleted = false'];

    if (operational_dept_id) { params.push(operational_dept_id); where.push(`u.operational_department_id = $${params.length}`); }
    if (role) { params.push(role); where.push(`r.name = $${params.length}`); }
    sql += ' WHERE ' + where.join(' AND ');
    sql += ' GROUP BY u.id ORDER BY u.name';

    const { rows } = await db.query(sql, params);
    success(res, rows);
  } catch (err) { next(err); }
});

// POST /api/v1/users
router.post(
  '/',
  authorize('Admin'),
  [
    body('name').notEmpty(), body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('employee_code').notEmpty().withMessage('Employee Code is required'),
    body('role_ids').isArray({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    const client = await db.getTenantClient();
    try {
      await client.query('BEGIN');
      const vid = req.user.vidyalaya_id;
      const { name, email, password, employee_code, operational_department_id, designation, role_ids } = req.body;

      // Restrict Vidyalaya Admins from assigning external or higher roles (e.g. Regional Officer)
      const { rows: disallowed } = await client.query(
        "SELECT name FROM role WHERE id = ANY($1::int[]) AND name IN ('RegionalOfficer', 'SuperAdmin')",
        [role_ids]
      );
      if (disallowed.length > 0) {
        await client.query('ROLLBACK');
        return error(res, 'Regional Officer / SuperAdmin roles cannot be assigned at Vidyalaya level.', 403);
      }

      const hash = await bcrypt.hash(password, 12);

      const { rows } = await client.query(
        `INSERT INTO "user" (name, email, password_hash, employee_code, operational_department_id, designation, vidyalaya_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, email, employee_code, operational_department_id, designation`,
        [name, email, hash, employee_code, operational_department_id || null, designation || null, vid]
      );
      const user = rows[0];

      for (const roleId of role_ids) {
        await client.query('INSERT INTO user_role (user_id, role_id) VALUES ($1, $2)', [user.id, roleId]);
      }

      await client.query(
        `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, vidyalaya_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['user', user.id, 'INSERT', user, req.user.id, vid]
      );

      await client.query('COMMIT');
      created(res, user);
    } catch (err) { await client.query('ROLLBACK'); next(err); }
    finally { client.release(); }
  }
);

// POST /api/v1/users/:id/reset-password — Reset user password to desired value
router.post(
  '/:id/reset-password',
  authorize('Admin'),
  [
    param('id').isInt().withMessage('Valid user ID required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  validate,
  async (req, res, next) => {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const { password } = req.body;
      const isSuper = req.user.isSuperAdmin;
      const vid = req.user.vidyalaya_id;

      // Verify user exists and belongs to the appropriate vidyalaya (unless SuperAdmin)
      const userQuery = isSuper
        ? 'SELECT id, name, email, employee_code, vidyalaya_id FROM "user" WHERE id = $1 AND is_deleted = false'
        : 'SELECT id, name, email, employee_code, vidyalaya_id FROM "user" WHERE id = $1 AND vidyalaya_id = $2 AND is_deleted = false';
      const userParams = isSuper ? [targetUserId] : [targetUserId, vid];

      const { rows } = await db.query(userQuery, userParams);
      if (rows.length === 0) {
        return error(res, 'User not found or inaccessible', 404);
      }

      const targetUser = rows[0];
      const hash = await bcrypt.hash(password, 12);

      await db.query(
        'UPDATE "user" SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hash, targetUserId]
      );

      await db.query(
        `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, vidyalaya_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'user',
          targetUserId,
          'PASSWORD_RESET',
          { reset_for: targetUser.employee_code, name: targetUser.name },
          req.user.id,
          targetUser.vidyalaya_id
        ]
      );

      success(res, {
        message: `Password for ${targetUser.name} (${targetUser.employee_code}) has been reset successfully.`
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/users/:id
router.put('/:id', authorize('Admin'),
  [param('id').isInt()], validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const isSuper = req.user.isSuperAdmin;
      const { name, employee_code, operational_department_id, designation, is_active, password } = req.body;
      const targetUserId = parseInt(req.params.id, 10);

      let hash = null;
      if (password && password.trim()) {
        if (password.trim().length < 6) {
          return error(res, 'Password must be at least 6 characters', 400);
        }
        hash = await bcrypt.hash(password.trim(), 12);
      }

      const query = isSuper
        ? `UPDATE "user" SET
             name = COALESCE($1, name), employee_code = COALESCE($2, employee_code),
             operational_department_id = COALESCE($3, operational_department_id),
             designation = COALESCE($4, designation), is_active = COALESCE($5, is_active),
             password_hash = COALESCE($6, password_hash),
             updated_at = NOW()
           WHERE id = $7 AND is_deleted = false
           RETURNING id, name, email, employee_code, operational_department_id, designation, is_active, vidyalaya_id`
        : `UPDATE "user" SET
             name = COALESCE($1, name), employee_code = COALESCE($2, employee_code),
             operational_department_id = COALESCE($3, operational_department_id),
             designation = COALESCE($4, designation), is_active = COALESCE($5, is_active),
             password_hash = COALESCE($6, password_hash),
             updated_at = NOW()
           WHERE id = $7 AND vidyalaya_id = $8 AND is_deleted = false
           RETURNING id, name, email, employee_code, operational_department_id, designation, is_active, vidyalaya_id`;

      const params = isSuper
        ? [name, employee_code, operational_department_id, designation, is_active, hash, targetUserId]
        : [name, employee_code, operational_department_id, designation, is_active, hash, targetUserId, vid];

      const { rows } = await db.query(query, params);
      if (rows.length === 0) return error(res, 'User not found', 404);

      await db.query(
        `INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, vidyalaya_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['user', rows[0].id, hash ? 'UPDATE_WITH_PASSWORD' : 'UPDATE', rows[0], req.user.id, rows[0].vidyalaya_id]
      );

      success(res, rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/users/:id — Soft delete
router.delete('/:id', authorize('Admin'),
  [param('id').isInt()], validate,
  async (req, res, next) => {
    try {
      const vid = req.user.vidyalaya_id;
      const userId = parseInt(req.params.id);

      if (userId === req.user.id) {
        return error(res, 'You cannot delete your own account', 400);
      }

      const { rows } = await db.query(
        `UPDATE "user" SET is_deleted = true, deleted_at = NOW(), is_active = false, updated_at = NOW()
         WHERE id = $1 AND vidyalaya_id = $2 AND is_deleted = false
         RETURNING id, name, email`,
        [userId, vid]
      );

      if (rows.length === 0) return error(res, 'User not found or already deleted', 404);

      await db.query(
        `INSERT INTO audit_log (table_name, record_id, action, old_values, changed_by, vidyalaya_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['user', rows[0].id, 'DELETE', rows[0], req.user.id, vid]
      );

      success(res, { message: 'User permanently removed. No historical data affected.', user: rows[0] });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/roles (global table — excludes external/higher roles not assignable by school admin)
router.get('/roles', authorize('Admin'), async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM role WHERE name NOT IN ('RegionalOfficer', 'SuperAdmin') ORDER BY id"
    );
    success(res, rows);
  } catch (err) { next(err); }
});

module.exports = router;
