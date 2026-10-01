const jwt = require('jsonwebtoken');
const { rawQuery } = require('../config/db');
const { runWithContext } = require('../config/tenantContext');

/**
 * JWT authentication middleware.
 * Extracts Bearer token, verifies it, attaches req.user with roles,
 * and sets the AsyncLocalStorage tenant context for the request lifecycle.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // SuperAdmin path — no DB lookup, no vidyalaya_id
    if (decoded.isSuperAdmin) {
      req.user = { id: 0, name: 'SuperAdmin', roles: ['SuperAdmin'], isSuperAdmin: true };
      return runWithContext({ vidyalayaId: null, isSuperAdmin: true, userId: 0 }, () => next());
    }

    // Fetch user + roles + vidyalaya status (using rawQuery — no tenant context yet)
    const { rows } = await rawQuery(
      `SELECT u.id, u.name, u.email, u.employee_code, u.department_id,
              u.operational_department_id, u.designation, u.is_active, u.is_deleted,
              u.vidyalaya_id,
              v.kv_code, v.kv_name_en, v.kv_name_hi, v.status AS vidyalaya_status, v.is_active AS vidyalaya_active,
              ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL) AS roles
       FROM "user" u
       JOIN vidyalaya v ON v.id = u.vidyalaya_id
       LEFT JOIN user_role ur ON ur.user_id = u.id
       LEFT JOIN role r ON r.id = ur.role_id
       WHERE u.id = $1
       GROUP BY u.id, v.id`,
      [decoded.userId]
    );

    if (rows.length === 0 || !rows[0].is_active || rows[0].is_deleted) {
      return res.status(401).json({ success: false, error: 'User not found or inactive' });
    }

    const user = rows[0];

    // Enforce vidyalaya must be APPROVED and active
    if (user.vidyalaya_status !== 'APPROVED' || !user.vidyalaya_active) {
      return res.status(403).json({ success: false, error: 'Your Vidyalaya is not active or approved' });
    }

    req.user = user;

    // Set tenant context for the entire request lifecycle
    runWithContext(
      { vidyalayaId: user.vidyalaya_id, isSuperAdmin: false, userId: user.id },
      () => next()
    );
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    next(err);
  }
}

module.exports = authenticate;
