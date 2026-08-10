import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "../../../../lib/session";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

/**
 * POST /api/auth/logout (Next.js route handler)
 *
 * Proxies to the backend's POST /api/auth/logout (stateless no-op that clears
 * `ewt_token`) and additionally clears the frontend's own `ewt_session` cookie.
 */
export async function POST(request) {
  const cookieHeader = request.headers.get("cookie") || "";

  let backendRes;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: "POST",
      headers: { cookie: cookieHeader },
    });
  } catch {
    return NextResponse.json({ error: "Unable to reach the authentication service" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  const response = NextResponse.json(data, { status: backendRes.status });

  // NextResponse.cookies.delete() rewrites the entire Set-Cookie header from its
  // own internal map, so it must run *before* we append the backend's cookie
  // directly to the headers, or it clobbers that manual append.
  response.cookies.delete(SESSION_COOKIE_NAME);

  const setCookies =
    typeof backendRes.headers.getSetCookie === "function" ? backendRes.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
