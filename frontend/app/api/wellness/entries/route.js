import { NextResponse } from "next/server";
import { proxyToBackend } from "../../../../lib/backendProxy";

/** POST /api/wellness/entries (BFF proxy) -> backend POST /api/wellness/entries. */
export async function POST(request) {
  const result = await proxyToBackend(request, {
    method: "POST",
    path: "/api/wellness/entries",
    forwardBody: true,
  });
  return NextResponse.json(result.data, { status: result.status });
}
