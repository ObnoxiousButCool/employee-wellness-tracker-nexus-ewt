import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  startWellnessScoringBackend,
  req,
  token,
  engineeringId,
  salesId,
  emptyDeptId,
  managerId,
  wellnessScoringBackendAvailable,
} from "./helpers/wellnessScoringFixtures.js";

/**
 * Genuine live-backend verification for
 * `GET /api/departments/:departmentId/wellness/score` (the S6
 * department-mean endpoint). Real backend, real sockets, real code -- no
 * mocked `fetch`. See `wellnessScoringListLiveBackendVerification.test.js`
 * for the sibling `GET /api/wellness/scores` coverage -- split from one
 * file into these two (S6 fix iteration 2) to stay under this project's
 * per-file line ceiling; both share `helpers/wellnessScoringFixtures.js`.
 */

let server;
let backendUrl;

beforeAll(async () => {
  ({ server, backendUrl } = await startWellnessScoringBackend());
});

afterAll(() => {
  server.close();
});

async function importDepartmentScoreRoute() {
  vi.resetModules();
  process.env.BACKEND_URL = backendUrl;
  const mod = await import("../app/api/departments/[departmentId]/wellness/score/route.js");
  return mod.GET;
}

describe.skipIf(!wellnessScoringBackendAvailable)(
  "frontend <-> real backend/src/app.js GET /api/departments/:departmentId/wellness/score (real Express app, frontend-owned fake, real sockets, no mocks)",
  () => {
  test("returns the correct arithmetic mean of latest scores (96 + 8) / 2 = 52", async () => {
    const GET = await importDepartmentScoreRoute();
    const cookie = `ewt_token=${token(99, "ADMIN", null)}`;

    const res = await GET(req(`http://localhost:3000/api/departments/${engineeringId}/wellness/score`, cookie), {
      params: { departmentId: String(engineeringId) },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ departmentId: engineeringId, score: 52 });
  });

  test("returns null (not 0) when its only employee has no entries", async () => {
    const GET = await importDepartmentScoreRoute();
    const cookie = `ewt_token=${token(99, "ADMIN", null)}`;

    const res = await GET(req(`http://localhost:3000/api/departments/${emptyDeptId}/wellness/score`, cookie), {
      params: { departmentId: String(emptyDeptId) },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ departmentId: emptyDeptId, score: null });
  });

  test("MANAGER: a real 403 requesting another department's score", async () => {
    const GET = await importDepartmentScoreRoute();
    const cookie = `ewt_token=${token(managerId, "MANAGER", engineeringId)}`;

    const res = await GET(req(`http://localhost:3000/api/departments/${salesId}/wellness/score`, cookie), {
      params: { departmentId: String(salesId) },
    });
    expect(res.status).toBe(403);
  });

  test("a real 404 for an unknown department", async () => {
    const GET = await importDepartmentScoreRoute();
    const cookie = `ewt_token=${token(99, "ADMIN", null)}`;

    const res = await GET(req("http://localhost:3000/api/departments/999/wellness/score", cookie), {
      params: { departmentId: "999" },
    });
    expect(res.status).toBe(404);
  });
  }
);
