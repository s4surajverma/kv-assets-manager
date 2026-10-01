const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth');
const { rawQuery } = require('../config/db');
const db = require('../config/db');
const { success, error, created } = require('../utils/responseHelper');

// POST /api/v1/auth/register-vidyalaya
router.post('/register-vidyalaya', [
  body('kv_code').notEmpty(),
  body('kv_name_en').notEmpty(),
  body('kv_name_hi').notEmpty(),
  body('regional_office_en').notEmpty(),
  body('regional_office_hi').notEmpty(),
  body('admin_name').notEmpty(),
  body('admin_email').isEmail(),
  body('admin_emp_code').notEmpty(),
  body('admin_password').isLength({ min: 6 })
], validate, async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { kv_code, kv_name_en, kv_name_hi, regional_office_en, regional_office_hi, admin_name, admin_email, admin_emp_code, admin_password } = req.body;

    // Check if kv_code already exists
    const existingKv = await client.query('SELECT id FROM vidyalaya WHERE kv_code = $1', [kv_code]);
    if (existingKv.rows.length > 0) {
      await client.query('ROLLBACK');
      return error(res, 'Vidyalaya with this KV Code already exists', 400);
    }

    // Insert Vidyalaya as APPROVED and active for immediate portal access
    const vidRes = await client.query(
      `INSERT INTO vidyalaya (kv_code, kv_name_en, kv_name_hi, regional_office_en, regional_office_hi, status, is_active, is_system) 
       VALUES ($1, $2, $3, $4, $5, 'APPROVED', true, false) RETURNING id`,
      [kv_code, kv_name_en, kv_name_hi, regional_office_en, regional_office_hi]
    );
    const vidId = vidRes.rows[0].id;

    // Insert Admin User
    const hash = await bcrypt.hash(admin_password, 12);
    const userRes = await client.query(
      `INSERT INTO "user" (name, email, password_hash, employee_code, vidyalaya_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [admin_name, admin_email, hash, admin_emp_code, vidId]
    );
    const userId = userRes.rows[0].id;

    // Get Admin role id
    const roleRes = await client.query('SELECT id FROM role WHERE name = $1', ['Admin']);
    const adminRoleId = roleRes.rows[0].id;

    // Assign Admin role
    await client.query('INSERT INTO user_role (user_id, role_id) VALUES ($1, $2)', [userId, adminRoleId]);

    await client.query('COMMIT');
    created(res, { message: 'Vidyalaya registered successfully and is pending authorization.' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/v1/auth/login
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username (KV Code or Employee Code) required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { username, password } = req.body;

      // ── SuperAdmin: env-based login (no DB record) ──
      if (
        process.env.SUPERADMIN_USERNAME &&
        process.env.SUPERADMIN_PASSWORD &&
        username === process.env.SUPERADMIN_USERNAME &&
        password === process.env.SUPERADMIN_PASSWORD
      ) {
        const token = jwt.sign(
          { isSuperAdmin: true },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );
        const refreshToken = jwt.sign(
          { isSuperAdmin: true },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
        );
        return success(res, {
          token,
          refreshToken,
          user: {
            id: 0,
            name: 'Super Administrator',
            email: '',
            employee_code: username,
            roles: ['SuperAdmin'],
            isSuperAdmin: true,
            kv_code: 'SYSTEM',
            kv_name_en: 'System Administration',
            kv_name_hi: 'प्रणाली प्रशासन',
          },
        });
      }

      // ── Regular user login ──
      const { rows } = await rawQuery(
        `SELECT u.*, v.status AS vidyalaya_status, v.is_active AS vidyalaya_active,
                v.kv_code, v.kv_name_en, v.kv_name_hi,
                ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL) AS roles
         FROM "user" u
         JOIN vidyalaya v ON v.id = u.vidyalaya_id
         LEFT JOIN user_role ur ON ur.user_id = u.id
         LEFT JOIN role r ON r.id = ur.role_id
         WHERE u.employee_code = $1
           AND u.is_active = true
           AND u.is_deleted = false
         GROUP BY u.id, v.id`,
        [username]
      );

      if (rows.length === 0) return error(res, 'Invalid credentials', 401);
      const user = rows[0];

      // Vidyalaya must be approved and active
      if (user.vidyalaya_status !== 'APPROVED') return error(res, 'Your Vidyalaya registration is pending approval', 403);
      if (!user.vidyalaya_active) return error(res, 'Your Vidyalaya has been temporarily suspended', 403);

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return error(res, 'Invalid credentials', 401);

      // Include vidyalaya_id in JWT
      const token = jwt.sign(
        { userId: user.id, vidyalayaId: user.vidyalaya_id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
      );
      const refreshToken = jwt.sign(
        { userId: user.id, vidyalayaId: user.vidyalaya_id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
      );

      await rawQuery('UPDATE "user" SET last_login = NOW() WHERE id = $1', [user.id]);

      success(res, {
        token,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          employee_code: user.employee_code,
          department_id: user.operational_department_id,
          designation: user.designation,
          roles: user.roles || [],
          vidyalaya_id: user.vidyalaya_id,
          kv_code: user.kv_code,
          kv_name_en: user.kv_name_en,
          kv_name_hi: user.kv_name_hi,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/refresh
router.post('/refresh', [body('refreshToken').notEmpty()], validate, async (req, res, next) => {
  try {
    const decoded = jwt.verify(req.body.refreshToken, process.env.JWT_REFRESH_SECRET);
    const token = jwt.sign(
      { userId: decoded.userId, vidyalayaId: decoded.vidyalayaId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    success(res, { token });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return error(res, 'Invalid or expired refresh token', 401);
    }
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, (req, res) => {
  success(res, { message: 'Logged out' });
});

// POST /api/v1/auth/change-password
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], validate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { rows } = await rawQuery('SELECT password_hash FROM "user" WHERE id = $1', [req.user.id]);
    if (rows.length === 0) return error(res, 'User not found', 404);

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return error(res, 'Invalid current password', 400);

    const hash = await bcrypt.hash(newPassword, 12);
    await rawQuery('UPDATE "user" SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    success(res, { message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    if (req.user.isSuperAdmin) {
      return success(res, {
        id: 0,
        name: 'Super Administrator',
        email: '',
        employee_code: 'SUPERADMIN',
        roles: ['SuperAdmin'],
        isSuperAdmin: true,
        kv_code: 'SYSTEM',
        kv_name_en: 'System Administration',
        kv_name_hi: 'प्रणाली प्रशासन',
      });
    }

    const { rows } = await rawQuery(
      `SELECT u.id, u.name, u.email, u.employee_code, u.department_id,
              u.operational_department_id, u.designation, u.vidyalaya_id,
              v.kv_code, v.kv_name_en, v.kv_name_hi, v.regional_office_en, v.regional_office_hi,
              ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL) AS roles
       FROM "user" u
       JOIN vidyalaya v ON v.id = u.vidyalaya_id
       LEFT JOIN user_role ur ON ur.user_id = u.id
       LEFT JOIN role r ON r.id = ur.role_id
       WHERE u.id = $1
       GROUP BY u.id, v.id`,
      [req.user.id]
    );

    if (rows.length === 0) return error(res, 'User not found', 404);
    const u = rows[0];

    return success(res, {
      id: u.id,
      name: u.name,
      email: u.email,
      employee_code: u.employee_code,
      department_id: u.department_id,
      operational_department_id: u.operational_department_id,
      designation: u.designation,
      vidyalaya_id: u.vidyalaya_id,
      kv_code: u.kv_code,
      kv_name_en: u.kv_name_en,
      kv_name_hi: u.kv_name_hi,
      regional_office_en: u.regional_office_en,
      regional_office_hi: u.regional_office_hi,
      roles: u.roles || [],
      isSuperAdmin: false,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
