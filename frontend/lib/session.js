import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "ewt_session";

/**
 * Parses the raw `ewt_session` cookie value (JSON: userId, role, departmentId)
 * set by the frontend's own auth API route immediately after a successful
 * backend login. Never contains the JWT itself.
 * @param {string|undefined} raw
 * @returns {{userId: number, role: string, departmentId: number|null}|null}
 */
export function parseSessionCookie(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.role !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Reads and parses the current request's session cookie.
 * Server-only: relies on next/headers `cookies()`.
 * @returns {{userId: number, role: string, departmentId: number|null}|null}
 */
export function getSession() {
  const raw = cookies().get(SESSION_COOKIE_NAME)?.value;
  return parseSessionCookie(raw);
}
