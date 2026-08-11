import { NextResponse } from "next/server";
import { proxyToBackend } from "../../../../lib/backendProxy";

/** GET /api/admin/departments (BFF proxy) -> backend GET /api/admin/departments, query string forwarded as-is. */
export async function GET(request) {
  const search = new URL(request.url).search;
  const result = await proxyToBackend(request, { method: "GET", path: `/api/admin/departments${search}` });
  return NextResponse.json(result.data, { status: result.status });
}

/** POST /api/admin/departments (BFF proxy) -> backend POST /api/admin/departments. */
export async function POST(request) {
  const result = await proxyToBackend(request, {
    method: "POST",
    path: "/api/admin/departments",
    forwardBody: true,
  });
  return NextResponse.json(result.data, { status: result.status });
}
