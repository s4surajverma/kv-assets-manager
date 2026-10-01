/**
 * Role → Module access mapping.
 *
 * Role keys MUST match exactly what the backend returns in user.roles[]
 * (the `role.name` column: Admin, Principal, StockHolder, TeacherInCharge, RegionalOfficer, Auditor).
 *
 * Module keys MUST match the `module` field in Sidebar NAV items.
 *
 * This ONLY controls sidebar visibility and page-level access.
 * Action-level permissions (create, update, delete) are enforced by backend RBAC.
 */
export const ROLE_PERMISSIONS = {
  Admin: ["*"],

  StockHolder: [
    "dashboard",
    "stock",
    "assets",
    "depreciation",
    "verification",
    "condemnation"
  ],

  RegionalOfficer: [
    "dashboard",
    "sanctions",
    "reports"
  ]
};
