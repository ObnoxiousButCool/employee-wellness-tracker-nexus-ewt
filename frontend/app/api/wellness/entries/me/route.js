import { NextResponse } from "next/server";
import { proxyToBackend } from "../../../../../lib/backendProxy";

/** GET /api/wellness/entries/me (BFF proxy) -> backend GET /api/wellness/entries/me, query string forwarded as-is. */
export async function GET(request) {
  const search = new URL(request.url).search;
  const result = await proxyToBackend(request, { method: "GET", path: `/api/wellness/entries/me${search}` });
  return NextResponse.json(result.data, { status: result.status });
}
