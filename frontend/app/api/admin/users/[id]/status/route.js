import { NextResponse } from "next/server";
import { proxyToBackend } from "../../../../../../lib/backendProxy";

/** PATCH /api/admin/users/:id/status (BFF proxy) -> backend PATCH /api/admin/users/:id/status. */
export async function PATCH(request, { params }) {
  const result = await proxyToBackend(request, {
    method: "PATCH",
    path: `/api/admin/users/${params.id}/status`,
    forwardBody: true,
  });
  return NextResponse.json(result.data, { status: result.status });
}
