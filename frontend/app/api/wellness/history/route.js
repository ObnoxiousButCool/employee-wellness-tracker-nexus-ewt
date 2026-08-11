import { NextResponse } from "next/server";
import { proxyToBackend } from "../../../../lib/backendProxy";

/** GET /api/wellness/history (BFF proxy) -> backend GET /api/wellness/history, query string forwarded as-is. */
export async function GET(request) {
  const search = new URL(request.url).search;
  const result = await proxyToBackend(request, { method: "GET", path: `/api/wellness/history${search}` });
  return NextResponse.json(result.data, { status: result.status });
}
