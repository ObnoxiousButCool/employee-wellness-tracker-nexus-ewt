import { NextResponse } from "next/server";
import { proxyToBackend } from "../../../../../../lib/backendProxy";

/** GET /api/departments/:departmentId/wellness/score (BFF proxy) -> backend GET /api/departments/:departmentId/wellness/score. */
export async function GET(request, { params }) {
  const result = await proxyToBackend(request, {
    method: "GET",
    path: `/api/departments/${params.departmentId}/wellness/score`,
  });
  return NextResponse.json(result.data, { status: result.status });
}
