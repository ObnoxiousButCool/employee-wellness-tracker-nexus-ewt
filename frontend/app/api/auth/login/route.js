import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "../../../../lib/session";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // mirrors the backend JWT's 8h expiry

/**
 * POST /api/auth/login (Next.js route handler)
 *
 * Proxies to the backend's POST /api/auth/login so the browser only ever
 * talks to the frontend's own origin (avoids CORS, and lets the backend's
 * httpOnly/Secure/SameSite=Strict `ewt_token` cookie be forwarded as-is).
 * On success also sets a same-origin `ewt_session` cookie carrying the
 * non-sensitive claims (userId, role, departmentId) purely as a display
 * convenience. This cookie is plain JSON and is NOT trusted for access
 * control: it is httpOnly so client JS can't read it, but it is not signed,
 * so it must never gate a route. RoleGuard/`getSession()` (see lib/session.js)
 * authorize exclusively off the backend-signed `ewt_token` JWT relayed below.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let backendRes;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "Unable to reach the authentication service" }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => ({}));
  const response = NextResponse.json(data, { status: backendRes.status });

  if (backendRes.ok) {
    // NextResponse.cookies.set() rewrites the entire Set-Cookie header from its
    // own internal map, so it must run *before* we append the backend's cookie
    // directly to the headers, or it clobbers that manual append.
    response.cookies.set(SESSION_COOKIE_NAME, JSON.stringify({
      userId: data.userId,
      role: data.role,
      departmentId: data.departmentId ?? null,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    const setCookies =
      typeof backendRes.headers.getSetCookie === "function" ? backendRes.headers.getSetCookie() : [];
    for (const cookie of setCookies) {
      response.headers.append("set-cookie", cookie);
    }
  }

  return response;
}
