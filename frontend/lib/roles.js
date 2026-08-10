/** Central definitions for the three EWT roles and their post-login landing pages. */

export const ROLES = Object.freeze({
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
});

export const LOGIN_PATH = "/login";

export const ROLE_LANDING_PATHS = Object.freeze({
  [ROLES.ADMIN]: "/admin/dashboard",
  [ROLES.MANAGER]: "/manager/dashboard",
  [ROLES.EMPLOYEE]: "/employee/home",
});

/**
 * Resolves the post-login redirect path for a given role.
 * Falls back to the login page for an unrecognized role.
 * @param {string} role
 * @returns {string}
 */
export function getLandingPathForRole(role) {
  return ROLE_LANDING_PATHS[role] || LOGIN_PATH;
}

/**
 * Decides whether a session is allowed to view a route guarded by `allowedRoles`.
 * Pure function so it can be unit tested without a Next.js request context.
 * @param {{userId: number, role: string, departmentId: number|null}|null} session
 * @param {string[]} allowedRoles
 * @returns {{allowed: boolean, redirectTo: string|null}}
 */
export function resolveAccess(session, allowedRoles) {
  if (!session || !session.role) {
    return { allowed: false, redirectTo: LOGIN_PATH };
  }
  if (!allowedRoles.includes(session.role)) {
    return { allowed: false, redirectTo: LOGIN_PATH };
  }
  return { allowed: true, redirectTo: null };
}
