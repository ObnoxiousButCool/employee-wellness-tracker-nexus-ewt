import { afterEach, describe, expect, test, vi } from "vitest";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

const redirectMock = vi.fn((path) => {
  throw new Error(`REDIRECT:${path}`);
});
let cookieStore = new Map();

vi.mock("next/navigation", () => ({
  redirect: (path) => redirectMock(path),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined),
  }),
}));

function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256", expiresIn: "8h" });
}

describe("RoleGuard", () => {
  afterEach(() => {
    cookieStore = new Map();
    redirectMock.mockClear();
    vi.resetModules();
  });

  test("redirects to /login when there is no ewt_token cookie", async () => {
    const { default: RoleGuard } = await import("../components/RoleGuard");
    expect(() => RoleGuard({ allowedRoles: ["ADMIN"], children: "protected" })).toThrow("REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  test("redirects to /login when a forged (unsigned) ewt_session-style cookie is presented as ewt_token", async () => {
    cookieStore.set("ewt_token", Buffer.from(JSON.stringify({ userId: 1, role: "ADMIN" })).toString("base64"));
    const { default: RoleGuard } = await import("../components/RoleGuard");
    expect(() => RoleGuard({ allowedRoles: ["ADMIN"], children: "protected" })).toThrow("REDIRECT:/login");
  });

  test("redirects to /login when the token is validly signed but the role isn't allowed", async () => {
    cookieStore.set("ewt_token", sign({ userId: 1, role: "EMPLOYEE", departmentId: 1 }));
    const { default: RoleGuard } = await import("../components/RoleGuard");
    expect(() => RoleGuard({ allowedRoles: ["ADMIN"], children: "protected" })).toThrow("REDIRECT:/login");
  });

  test("renders children when the token is validly signed and the role is allowed", async () => {
    cookieStore.set("ewt_token", sign({ userId: 1, role: "ADMIN", departmentId: 3 }));
    const { default: RoleGuard } = await import("../components/RoleGuard");
    expect(RoleGuard({ allowedRoles: ["ADMIN"], children: "protected" })).toBe("protected");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
