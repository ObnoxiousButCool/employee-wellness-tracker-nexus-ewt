import { NextResponse } from "next/server";
import { proxyToBackend } from "../../../../lib/backendProxy";

/** GET /api/dashboard/summary (BFF proxy) -> backend GET /api/dashboard/summary, query string forwarded as-is. */
export async function GET(request) {
  const search = new URL(request.url).search;
  const result = await proxyToBackend(request, { method: "GET", path: `/api/dashboard/summary${search}` });
  return NextResponse.json(result.data, { status: result.status });
}
