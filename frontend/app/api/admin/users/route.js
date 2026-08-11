import { NextResponse } from "next/server";
import { proxyToBackend } from "../../../../lib/backendProxy";

/** GET /api/admin/users (BFF proxy) -> backend GET /api/admin/users, query string forwarded as-is. */
export async function GET(request) {
  const search = new URL(request.url).search;
  const result = await proxyToBackend(request, { method: "GET", path: `/api/admin/users${search}` });
  return NextResponse.json(result.data, { status: result.status });
}

/** POST /api/admin/users (BFF proxy) -> backend POST /api/admin/users. */
export async function POST(request) {
  const result = await proxyToBackend(request, {
    method: "POST",
    path: "/api/admin/users",
    forwardBody: true,
  });
  return NextResponse.json(result.data, { status: result.status });
}
