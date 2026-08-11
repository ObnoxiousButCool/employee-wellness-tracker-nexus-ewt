import { NextResponse } from "next/server";
import { proxyToBackend } from "../../../../../lib/backendProxy";

/** PUT /api/admin/departments/:id (BFF proxy) -> backend PUT /api/admin/departments/:id. */
export async function PUT(request, { params }) {
  const result = await proxyToBackend(request, {
    method: "PUT",
    path: `/api/admin/departments/${params.id}`,
    forwardBody: true,
  });
  return NextResponse.json(result.data, { status: result.status });
}
