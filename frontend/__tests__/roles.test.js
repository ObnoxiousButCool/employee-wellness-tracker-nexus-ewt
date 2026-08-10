import { describe, expect, test } from "vitest";
import { getLandingPathForRole, resolveAccess, ROLES, LOGIN_PATH } from "../lib/roles";

describe("getLandingPathForRole", () => {
  test("maps each known role to its landing page", () => {
    expect(getLandingPathForRole(ROLES.ADMIN)).toBe("/admin/dashboard");
    expect(getLandingPathForRole(ROLES.MANAGER)).toBe("/manager/dashboard");
    expect(getLandingPathForRole(ROLES.EMPLOYEE)).toBe("/employee/home");
  });

  test("falls back to /login for an unrecognized role", () => {
    expect(getLandingPathForRole("SUPERUSER")).toBe(LOGIN_PATH);
    expect(getLandingPathForRole(undefined)).toBe(LOGIN_PATH);
  });
});

describe("resolveAccess", () => {
  test("denies and redirects to /login when there is no session", () => {
    expect(resolveAccess(null, [ROLES.ADMIN])).toEqual({ allowed: false, redirectTo: LOGIN_PATH });
  });

  test("denies and redirects to /login when the role is not allowed", () => {
    const session = { userId: 1, role: ROLES.EMPLOYEE, departmentId: 2 };
    expect(resolveAccess(session, [ROLES.ADMIN, ROLES.MANAGER])).toEqual({
      allowed: false,
      redirectTo: LOGIN_PATH,
    });
  });

  test("allows access when the session role is in the allowed list", () => {
    const session = { userId: 1, role: ROLES.MANAGER, departmentId: 2 };
    expect(resolveAccess(session, [ROLES.MANAGER])).toEqual({ allowed: true, redirectTo: null });
  });
});
