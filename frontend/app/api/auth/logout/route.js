import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../../../lib/session";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

/**
 * POST /api/auth/logout (Next.js route handler)
 *
 * Proxies to the backend's POST /api/auth/logout (stateless no-op that clears
 * `ewt_token`) and additionally clears the frontend's own `ewt_session`
 * cookie. Clearing both cookies happens unconditionally, even when the
 * backend proxy call fails: the JWT is stateless, so there is nothing for
 * the backend to invalidate server-side beyond what its own Set-Cookie
 * already does, and the browser must never end up half-signed-out (still
 * holding `ewt_token`) just because the backend was briefly unreachable.
 */
export async function POST(request) {
  const cookieHeader = request.headers.get("cookie") || "";

  let backendRes = null;
  let backendUnreachable = false;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: "POST",
      headers: { cookie: cookieHeader },
    });
  } catch {
    backendUnreachable = true;
  }

  const data = backendRes ? await backendRes.json().catch(() => ({})) : null;
  const body = backendUnreachable
    ? { message: "Logged out locally; the authentication service could not be reached to confirm." }
    : data;
  const status = backendRes ? backendRes.status : 200;
  const response = NextResponse.json(body, { status });

  // NextResponse.cookies.delete() rewrites the entire Set-Cookie header from its
  // own internal map, so it must run *before* we append the backend's cookie
  // directly to the headers, or it clobbers that manual append.
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(AUTH_COOKIE_NAME);

  const setCookies =
    backendRes && typeof backendRes.headers.getSetCookie === "function" ? backendRes.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
