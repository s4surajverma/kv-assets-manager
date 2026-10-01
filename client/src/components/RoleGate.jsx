import { useAuth } from '../context/AuthContext';

/**
 * Conditionally renders children only if user has one of the required roles.
 * Admin always passes. If user lacks roles, renders `fallback` (default: nothing).
 *
 * Usage:
 *   <RoleGate roles={['StockHolder']}>
 *     <Link to="/stock/new">+ New Entry</Link>
 *   </RoleGate>
 */
export default function RoleGate({ roles, children, fallback = null }) {
  const { hasRole } = useAuth();
  if (!roles || hasRole(...roles)) return children;
  return fallback;
}
