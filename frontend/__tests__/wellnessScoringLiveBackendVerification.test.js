import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import http from "node:http";
import jwt from "jsonwebtoken";

/**
 * Genuine live-backend verification for the S6
 * `GET /api/wellness/scores` and `GET /api/departments/:departmentId/wellness/score`
 * endpoints. Real backend, real sockets, real code -- no mocked `fetch`, no
 * stand-in server. Imports the backend's actual Express app
 * (`backend/src/app.js` via `createApp`) and starts it on a real ephemeral
 * localhost port, wired to this frontend layer's OWN in-memory Prisma fake
 * (`__tests__/helpers/dashboardFakePrisma.js`, S5) -- its `department`/
 * `user`-with-nested-`role`/`wellnessEntry` surface is exactly what
 * `wellnessScoringController.js` calls, so it is reused rather than
 * duplicated (same reasoning as `wellnessFakePrisma.js`, S4 fix iteration 2).
 * The frontend's actual `/api/wellness/scores` and
 * `/api/departments/:departmentId/wellness/score` BFF route handlers are
 * driven against the real server over a real TCP socket with real signed
 * `ewt_token` cookies -- no mocked `fetch`.
 */

const TEST_JWT_SECRET = "wellness-scoring-live-verification-secret";
process.env.JWT_SECRET = TEST_JWT_SECRET;

function token(userId, role, departmentId) {
  return jwt.sign({ userId, role, departmentId }, TEST_JWT_SECRET, { expiresIn: "8h" });
}

const engineeringId = 1;
const salesId = 2;
const emptyDeptId = 3;

const empThrivingId = 10; // Engineering, hand-computed score 96 (Thriving)
const empCriticalId = 11; // Engineering, hand-computed score 8 (Critical)
const empStableId = 20; // Sales, hand-computed score 65 (Stable)
const empNoEntriesId = 30; // Empty dept, no entries at all

let server;
let backendUrl;

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

beforeAll(async () => {
  const { default: createApp } = await import("../../backend/src/app.js");
  const { createDashboardFakePrisma } = await import("./helpers/dashboardFakePrisma.js");

  const prisma = createDashboardFakePrisma({
    departments: [
      { id: engineeringId, name: "Engineering", isActive: true },
      { id: salesId, name: "Sales", isActive: true },
      { id: emptyDeptId, name: "Empty", isActive: true },
    ],
    users: [
      { id: empThrivingId, name: "Thriving Employee", departmentId: engineeringId, isActive: true, role: { name: "EMPLOYEE" } },
      { id: empCriticalId, name: "Critical Employee", departmentId: engineeringId, isActive: true, role: { name: "EMPLOYEE" } },
      { id: empStableId, name: "Stable Employee", departmentId: salesId, isActive: true, role: { name: "EMPLOYEE" } },
      { id: empNoEntriesId, name: "No Entries Employee", departmentId: emptyDeptId, isActive: true, role: { name: "EMPLOYEE" } },
      { id: 40, name: "Manny Manager", departmentId: engineeringId, isActive: true, role: { name: "MANAGER" } },
    ],
    wellnessEntries: [
      // empThrivingId: an older, much worse entry, then a latest entry that computes to 96.
      { id: 1, userId: empThrivingId, entryDate: daysAgo(5), stressLevel: 10, workHours: 8, sleepHours: 0, mood: "LOW", energyLevel: "VERY_LOW" },
      { id: 2, userId: empThrivingId, entryDate: daysAgo(0), stressLevel: 1, workHours: 8, sleepHours: 8, mood: "GREAT", energyLevel: "VERY_HIGH" },
      // empCriticalId: single entry, computes to 8.
      { id: 3, userId: empCriticalId, entryDate: daysAgo(0), stressLevel: 10, workHours: 8, sleepHours: 2, mood: "LOW", energyLevel: "VERY_LOW" },
      // empStableId: single entry, computes to 65.
      { id: 4, userId: empStableId, entryDate: daysAgo(0), stressLevel: 5, workHours: 8, sleepHours: 8, mood: "GOOD", energyLevel: "MEDIUM" },
      // empNoEntriesId: intentionally none.
    ],
  });

  const app = createApp({ prisma });
  await new Promise((resolve) => {
    server = http.createServer(app).listen(0, "127.0.0.1", resolve);
  });
  backendUrl = `http://127.0.0.1:${server.address().port}`;
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

async function importDepartmentScoreRoute() {
  vi.resetModules();
  process.env.BACKEND_URL = backendUrl;
  const mod = await import("../app/api/departments/[departmentId]/wellness/score/route.js");
  return mod.GET;
}

function req(url, cookie) {
  return new Request(url, { headers: cookie ? { cookie } : {} });
}

describe("frontend <-> real backend/src/app.js wellness scoring routes (real Express app, frontend-owned fake, real sockets, no mocks)", () => {
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
    const cookie = `ewt_token=${token(40, "MANAGER", engineeringId)}`;

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

  test("the department-score endpoint returns the correct arithmetic mean of latest scores (96 + 8) / 2 = 52", async () => {
    const GET = await importDepartmentScoreRoute();
    const cookie = `ewt_token=${token(99, "ADMIN", null)}`;

    const res = await GET(req(`http://localhost:3000/api/departments/${engineeringId}/wellness/score`, cookie), {
      params: { departmentId: String(engineeringId) },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ departmentId: engineeringId, score: 52 });
  });

  test("the department-score endpoint returns null (not 0) when its only employee has no entries", async () => {
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
    const cookie = `ewt_token=${token(40, "MANAGER", engineeringId)}`;

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
});
