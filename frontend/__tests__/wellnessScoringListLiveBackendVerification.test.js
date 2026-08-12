import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  startWellnessScoringBackend,
  req,
  token,
  engineeringId,
  salesId,
  empThrivingId,
  empCriticalId,
  empStableId,
  empNoEntriesId,
  managerId,
  wellnessScoringBackendAvailable,
} from "./helpers/wellnessScoringFixtures.js";

/**
 * Genuine live-backend verification for `GET /api/wellness/scores` (the S6
 * employee list endpoint). Real backend, real sockets, real code -- no
 * mocked `fetch`. See `wellnessScoringDepartmentLiveBackendVerification.test.js`
 * for the sibling `GET /api/departments/:departmentId/wellness/score`
 * coverage -- split from one file into these two (S6 fix iteration 2) to
 * stay under this project's per-file line ceiling; both share
 * `helpers/wellnessScoringFixtures.js`.
 */

let server;
let backendUrl;

beforeAll(async () => {
  ({ server, backendUrl } = await startWellnessScoringBackend());
});

afterAll(() => {
  server.close();
});

async function importScoresRoute() {
  vi.resetModules();
  process.env.BACKEND_URL = backendUrl;
  const mod = await import("../app/api/wellness/scores/route.js");
  return mod.GET;
}

describe.skipIf(!wellnessScoringBackendAvailable)(
  "frontend <-> real backend/src/app.js GET /api/wellness/scores (real Express app, frontend-owned fake, real sockets, no mocks)",
  () => {
  test("ADMIN: org-wide list uses each employee's latest entry, exact formula (96/Thriving, 8/Critical, 65/Stable)", async () => {
    const GET = await importScoresRoute();
    const cookie = `ewt_token=${token(99, "ADMIN", null)}`;

    const res = await GET(req("http://localhost:3000/api/wellness/scores", cookie));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data).toEqual(
      expect.arrayContaining([
        { employeeId: empThrivingId, score: 96, classificationCategory: "Thriving" },
        { employeeId: empCriticalId, score: 8, classificationCategory: "Critical" },
        { employeeId: empStableId, score: 65, classificationCategory: "Stable" },
      ])
    );
  });

  test("ADMIN: an employee with no entries is omitted, not a placeholder row", async () => {
    const GET = await importScoresRoute();
    const cookie = `ewt_token=${token(99, "ADMIN", null)}`;

    const res = await GET(req("http://localhost:3000/api/wellness/scores", cookie));
    const body = await res.json();

    expect(body.data.find((row) => row.employeeId === empNoEntriesId)).toBeUndefined();
  });

  test("ADMIN: department filter scopes the list, and a malformed value gets a real 400", async () => {
    const GET = await importScoresRoute();
    const cookie = `ewt_token=${token(99, "ADMIN", null)}`;

    const scoped = await GET(req(`http://localhost:3000/api/wellness/scores?department=${salesId}`, cookie));
    expect(scoped.status).toBe(200);
    const scopedBody = await scoped.json();
    expect(scopedBody.data).toEqual([{ employeeId: empStableId, score: 65, classificationCategory: "Stable" }]);

    const malformed = await GET(req("http://localhost:3000/api/wellness/scores?department=abc", cookie));
    expect(malformed.status).toBe(400);
  });

  test("MANAGER: a client-supplied department is ignored, scoped to their own department only", async () => {
    const GET = await importScoresRoute();
    const cookie = `ewt_token=${token(managerId, "MANAGER", engineeringId)}`;

    const res = await GET(req(`http://localhost:3000/api/wellness/scores?department=${salesId}`, cookie));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data).toEqual(
      expect.arrayContaining([
        { employeeId: empThrivingId, score: 96, classificationCategory: "Thriving" },
        { employeeId: empCriticalId, score: 8, classificationCategory: "Critical" },
      ])
    );
    expect(body.data.find((row) => row.employeeId === empStableId)).toBeUndefined();
  });

  test("without a session cookie: real 401 over the wire", async () => {
    const GET = await importScoresRoute();
    const res = await GET(req("http://localhost:3000/api/wellness/scores"));
    expect(res.status).toBe(401);
  });

  test("an EMPLOYEE session: real 403 over the wire", async () => {
    const GET = await importScoresRoute();
    const cookie = `ewt_token=${token(empThrivingId, "EMPLOYEE", engineeringId)}`;
    const res = await GET(req("http://localhost:3000/api/wellness/scores", cookie));
    expect(res.status).toBe(403);
  });
  }
);
