/**
 * Static fallback role catalog for the admin user create/edit role picker.
 *
 * The API Contract has no `GET /api/admin/roles` endpoint — `roleId` on a
 * user record is an opaque FK, so deriving role options purely from
 * currently-loaded users leaves any role with zero assignees unselectable
 * (a fresh install, or any environment where e.g. no MANAGER has been
 * created yet). This fallback mirrors the `roles` table's documented seed
 * order (PROJECT_CONTEXT.md, Story S2 Backend iteration 1: "seeded
 * ADMIN/MANAGER/EMPLOYEE"), which is deterministic for a freshly-seeded
 * table (autoincrement PK, single seed insert). `buildRoleOptions` always
 * prefers roles actually observed in live data — this fallback only fills
 * in names that live data hasn't surfaced yet.
 */
export const STATIC_ROLE_CATALOG = Object.freeze([
  { roleId: 1, role: "ADMIN" },
  { roleId: 2, role: "MANAGER" },
  { roleId: 3, role: "EMPLOYEE" },
]);

/**
 * Merges roles observed in live `GET /api/admin/users` data with the static
 * fallback catalog so every documented role is always selectable, even when
 * no user of that role exists yet. Entries observed in live data always win
 * by role name, since they carry a confirmed, environment-real `roleId`.
 * @param {{roleId: number, role: string}[]} observedRoles
 * @returns {{roleId: number, role: string}[]}
 */
export function buildRoleOptions(observedRoles) {
  const byName = new Map();
  for (const fallback of STATIC_ROLE_CATALOG) byName.set(fallback.role, fallback);
  for (const observed of observedRoles) {
    if (observed.role) byName.set(observed.role, observed);
  }
  return Array.from(byName.values());
}
