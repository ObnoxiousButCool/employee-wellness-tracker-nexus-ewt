import http from "node:http";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

/**
 * Genuine live-backend verification for the S4 Manager/Admin wellness
 * reporting endpoints (`/api/wellness/history`,
 * `/api/wellness/employees/:id/profile`, `/api/wellness/employees/:id/trend`).
 * Boots the REAL `backend/src/app.js` (real Express app, real controllers,
 * real middleware) over a real TCP socket, wired to this frontend layer's
 * OWN in-memory Prisma fake (`__tests__/helpers/wellnessFakePrisma.js`)
 * rather than the backend's test-only `backend/tests/helpers/fakePrisma.js`
 * — importing a backend test helper from a frontend test coupled the prior
 * iteration to a file the frontend does not own. Follows the same
 * unconditional, backend-decoupled pattern as
 * `wellnessLiveIntegration.test.js` (S3): this file always runs (no
 * `describe.skipIf`), so the frontend diff itself guarantees the claimed
 * end-to-end verification actually executes in CI, rather than silently
 * skipping when backend sources aren't present alongside this branch.
 */

const TEST_JWT_SECRET = "wellness-reports-live-verification-secret";
process.env.JWT_SECRET = TEST_JWT_SECRET;

const employeeAId = 10;
const employeeBId = 20;

function token(userId, role, departmentId) {
  return jwt.sign({ userId, role, departmentId }, TEST_JWT_SECRET, { expiresIn: "8h" });
}

let server;
let baseUrl;
let managerToken;
let adminToken;

beforeAll(async () => {
  const { default: createApp } = await import("../../backend/src/app.js");
  const { createWellnessFakePrisma } = await import("./helpers/wellnessFakePrisma.js");

  // entryDate is a @db.Date column, always stored at local midnight (S3);
  // employeeProfileController's default range bounds are midnight-aligned
  // too (S4 fix iteration 2). Fixture dates must match, or an entry dated
  // "right now" (with a real time-of-day) falls after the midnight-aligned
  // `to` bound and gets silently excluded depending on when the test runs.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const prisma = createWellnessFakePrisma({
    users: [
      { id: 1, name: "Manny Manager", email: "manny@ewt.test", departmentId: 1 },
      { id: 2, name: "Other Manager", email: "other@ewt.test", departmentId: 2 },
      { id: 3, name: "Ann Admin", email: "ann@ewt.test", departmentId: null },
      { id: employeeAId, name: "Employee A", email: "a@ewt.test", departmentId: 1 },
      { id: employeeBId, name: "Employee B", email: "b@ewt.test", departmentId: 2 },
    ],
    wellnessEntries: [
      { id: 1, userId: employeeAId, entryDate: yesterday, stressLevel: 3, workHours: 8, sleepHours: 7, mood: "GOOD", energyLevel: "HIGH" },
      { id: 2, userId: employeeAId, entryDate: today, stressLevel: 7, workHours: 9, sleepHours: 5, mood: "LOW", energyLevel: "LOW" },
      { id: 3, userId: employeeBId, entryDate: today, stressLevel: 2, workHours: 6, sleepHours: 8, mood: "GREAT", energyLevel: "VERY_HIGH" },
    ],
  });

  const app = createApp({ prisma });
  await new Promise((resolve) => {
    server = http.createServer(app).listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  process.env.BACKEND_URL = baseUrl;

  managerToken = token(1, "MANAGER", 1);
  adminToken = token(3, "ADMIN", null);
});

afterAll(() => {
  server?.close();
});

function req(path_, tok) {
  return new Request(`${baseUrl}${path_}`, { headers: { cookie: `ewt_token=${tok}` } });
}

describe("frontend <-> real backend/src/app.js wellness reporting routes (real Express app, frontend-owned fake, real sockets, no mocks)", () => {
  test("GET /api/wellness/history (BFF) scopes a MANAGER to their own department, ignoring a client-supplied department", async () => {
    const { GET } = await import("../app/api/wellness/history/route.js");
    const res = await GET(req(`/api/wellness/history?department=2`, managerToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.every((row) => row.departmentId === 1)).toBe(true);
    expect(body.data.some((row) => row.userId === employeeBId)).toBe(false);
  });

  test("GET /api/wellness/history (BFF) an ADMIN can filter by department and see another manager's department", async () => {
    const { GET } = await import("../app/api/wellness/history/route.js");
    const res = await GET(req(`/api/wellness/history?department=2`, adminToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.every((row) => row.userId === employeeBId)).toBe(true);
  });

  test("GET /api/wellness/history (BFF) a userId outside the manager's department returns an empty page, not a 403", async () => {
    const { GET } = await import("../app/api/wellness/history/route.js");
    const res = await GET(req(`/api/wellness/history?userId=${employeeBId}`, managerToken));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  test("GET /api/wellness/history (BFF) supports the sortBy/sortOrder column-sort toggle for real", async () => {
    const { GET } = await import("../app/api/wellness/history/route.js");
    const res = await GET(req(`/api/wellness/history?sortBy=stressLevel&sortOrder=asc`, managerToken));
    expect(res.status).toBe(200);
    const stressLevels = (await res.json()).data.map((r) => r.stressLevel);
    expect(stressLevels).toEqual([...stressLevels].sort((a, b) => a - b));
  });

  test("GET /api/wellness/history (BFF) is 403 for a session without ADMIN/MANAGER role", async () => {
    const employeeSessionToken = token(employeeAId, "EMPLOYEE", 1);
    const { GET } = await import("../app/api/wellness/history/route.js");
    const res = await GET(req(`/api/wellness/history`, employeeSessionToken));
    expect(res.status).toBe(403);
  });

  test("GET /api/wellness/employees/:id/profile (BFF) returns averaged stats for the real seeded entries", async () => {
    const { GET } = await import("../app/api/wellness/employees/[id]/profile/route.js");
    const res = await GET(req(`/api/wellness/employees/${employeeAId}/profile`, managerToken), {
      params: { id: String(employeeAId) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Employee A");
    expect(body.stats.entryCount).toBe(2);
    expect(body.stats.avgStressLevel).toBe(5);
  });

  test("GET /api/wellness/employees/:id/profile (BFF) real 403 when a manager reaches an employee outside their department", async () => {
    const { GET } = await import("../app/api/wellness/employees/[id]/profile/route.js");
    const res = await GET(req(`/api/wellness/employees/${employeeBId}/profile`, managerToken), {
      params: { id: String(employeeBId) },
    });
    expect(res.status).toBe(403);
  });

  test("GET /api/wellness/employees/:id/profile (BFF) real 404 for a nonexistent employee", async () => {
    const { GET } = await import("../app/api/wellness/employees/[id]/profile/route.js");
    const res = await GET(req(`/api/wellness/employees/9999/profile`, adminToken), { params: { id: "9999" } });
    expect(res.status).toBe(404);
  });

  test("GET /api/wellness/employees/:id/trend (BFF) returns an oldest-first pre-aggregated series", async () => {
    const { GET } = await import("../app/api/wellness/employees/[id]/trend/route.js");
    const res = await GET(req(`/api/wellness/employees/${employeeAId}/trend?metric=stress&range=30d`, managerToken), {
      params: { id: String(employeeAId) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
    expect(body.data[0].value).toBe(3);
    expect(body.data[1].value).toBe(7);
  });

  test("GET /api/wellness/employees/:id/trend (BFF) real 400 for an invalid metric", async () => {
    const { GET } = await import("../app/api/wellness/employees/[id]/trend/route.js");
    const res = await GET(req(`/api/wellness/employees/${employeeAId}/trend?metric=bad&range=30d`, adminToken), {
      params: { id: String(employeeAId) },
    });
    expect(res.status).toBe(400);
  });

  // S7 data-protection requirement: no sensitive field (password hash, raw
  // token) may ever be serialized into an API response. Asserted against the
  // real live-backend response body for both the history grid and the
  // employee profile, not just by reading the controller source.
  test("history and employee-profile responses never serialize a passwordHash or raw token", async () => {
    const { GET: getHistory } = await import("../app/api/wellness/history/route.js");
    const historyRes = await getHistory(req(`/api/wellness/history`, adminToken));
    expect(historyRes.status).toBe(200);
    const historyRaw = await historyRes.text();
    expect(historyRaw).not.toMatch(/passwordHash/i);
    expect(historyRaw).not.toMatch(/ewt_token/i);

    const { GET: getProfile } = await import("../app/api/wellness/employees/[id]/profile/route.js");
    const profileRes = await getProfile(req(`/api/wellness/employees/${employeeAId}/profile`, managerToken), {
      params: { id: String(employeeAId) },
    });
    expect(profileRes.status).toBe(200);
    const profileRaw = await profileRes.text();
    expect(profileRaw).not.toMatch(/passwordHash/i);
    expect(profileRaw).not.toMatch(/ewt_token/i);
  });
});
