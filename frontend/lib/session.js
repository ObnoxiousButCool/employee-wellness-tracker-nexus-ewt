import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "ewt_token";
export const SESSION_COOKIE_NAME = "ewt_session";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";

/**
 * Verifies and decodes the signed `ewt_token` JWT the backend issues on
 * login. Unlike a plain JSON cookie, this cannot be forged from the browser:
 * a value that doesn't carry a valid HS256 signature for JWT_SECRET (the
 * same secret the backend signs with) is rejected outright. This is the
 * only source of truth for authorization decisions (RoleGuard); the
 * `ewt_session` cookie is a non-authoritative, readable-by-server-components
 * convenience mirror and must never be trusted for access control.
 * @param {string|undefined} raw
 * @returns {{userId: number, role: string, departmentId: number|null}|null}
 */
export function parseSessionToken(raw) {
  if (!raw) return null;
  try {
    const decoded = jwt.verify(raw, JWT_SECRET, { algorithms: ["HS256"] });
    if (!decoded || typeof decoded !== "object" || typeof decoded.role !== "string") return null;
    return {
      userId: decoded.userId,
      role: decoded.role,
      departmentId: decoded.departmentId ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the current request's `ewt_token` session JWT.
 * Server-only: relies on next/headers `cookies()`.
 * @returns {{userId: number, role: string, departmentId: number|null}|null}
 */
export function getSession() {
  const raw = cookies().get(AUTH_COOKIE_NAME)?.value;
  return parseSessionToken(raw);
}
