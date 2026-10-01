import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccess } from '../utils/permissionHelper';

export default function ProtectedRoute({ children, module, adminOnly }) {
  const { user } = useAuth();

  // Must be logged in
  if (!user) return <Navigate to="/login" replace />;

  if (adminOnly) {
    if (!user.isSuperAdmin && !user.roles?.includes('Admin')) {
      return <Navigate to="/" replace />;
    }
    return children;
  }

  // SuperAdmin should only access the root/dashboard (which handles approvals)
  if (user.isSuperAdmin && module) {
    return <Navigate to="/" replace />;
  }

  // Module-level access check (controls sidebar + page visibility)
  if (module && !canAccess(user.roles, module)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
