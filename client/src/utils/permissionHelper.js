import { ROLE_PERMISSIONS } from './rolePermissions';

export const canAccess = (userRoles, module) => {
  if (!userRoles || userRoles.length === 0) return false;

  for (const role of userRoles) {
    const perms = ROLE_PERMISSIONS[role];

    if (!perms) continue;

    if (perms.includes("*") || perms.includes(module)) {
      return true;
    }
  }

  return false;
};
