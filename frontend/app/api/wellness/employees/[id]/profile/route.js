import { NextResponse } from "next/server";
import { proxyToBackend } from "../../../../../../lib/backendProxy";

/** GET /api/wellness/employees/:id/profile (BFF proxy) -> backend GET /api/wellness/employees/:id/profile. */
export async function GET(request, { params }) {
  const search = new URL(request.url).search;
  const result = await proxyToBackend(request, {
    method: "GET",
    path: `/api/wellness/employees/${params.id}/profile${search}`,
  });
  return NextResponse.json(result.data, { status: result.status });
}
