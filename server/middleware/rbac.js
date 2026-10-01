/**
 * Role-based access control middleware factory.
 * Usage: authorize('Admin', 'Principal')
 * Checks req.user.roles (set by auth middleware) against allowed roles.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // SuperAdmin bypasses all role checks
    if (req.user.isSuperAdmin) {
      return next();
    }

    // Admin has wildcard access
    if (req.user.roles.includes('Admin')) {
      return next();
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

module.exports = authorize;
