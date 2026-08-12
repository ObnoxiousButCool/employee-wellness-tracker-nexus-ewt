import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import http from "node:http";
import jwt from "jsonwebtoken";

/**
 * Genuine live-backend verification for the S5 `GET /api/dashboard/summary`
 * endpoint. Real backend, real sockets, real code -- no mocked `fetch`, no
 * stand-in server. Imports the backend's actual Express app
 * (`backend/src/app.js` via `createApp`) and starts it on a real ephemeral
 * localhost port, wired to this frontend layer's OWN in-memory Prisma fake
 * (`__tests__/helpers/dashboardFakePrisma.js`, not the backend's own
 * `backend/tests/helpers/fakePrisma.js`, for the same "don't couple to a
 * file the frontend doesn't own" reason `wellnessFakePrisma.js` exists,
 * S4 fix iteration 2). The frontend's actual
 * `GET /api/dashboard/summary` BFF route handler is driven against the
 * real server over a real TCP socket with real signed `ewt_token` cookies
 * for both a MANAGER and an ADMIN -- no mocked `fetch` -- exercising: KPI
 * card values, wellness status distribution, department wellness scores,
 * a 7-point weekly trend, top-high-stress ranking, a MANAGER's scope being
 * forced to their own department even when a different one is requested,
 * an ADMIN's org-wide vs single-department scope, and the documented
 * 400/404 error responses.
 */

const TEST_JWT_SECRET = "dashboard-live-verification-secret";
process.env.JWT_SECRET = TEST_JWT_SECRET;

function token(userId, role, departmentId) {
  return jwt.sign({ userId, role, departmentId }, TEST_JWT_SECRET, { expiresIn: "8h" });
}

const engineeringId = 1;
const salesId = 2;
const empAId = 10; // engineering, high stress
const empBId = 11; // engineering, low stress
const empCId = 20; // sales

let server;
let backendUrl;

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysAgo(n) {
  const d = todayDateOnly();
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
    ],
    users: [
      { id: empAId, name: "Employee A", departmentId: engineeringId, isActive: true, role: { name: "EMPLOYEE" } },
      { id: empBId, name: "Employee B", departmentId: engineeringId, isActive: true, role: { name: "EMPLOYEE" } },
      { id: empCId, name: "Employee C", departmentId: salesId, isActive: true, role: { name: "EMPLOYEE" } },
      { id: 30, name: "Manny Manager", departmentId: engineeringId, isActive: true, role: { name: "MANAGER" } },
    ],
    wellnessEntries: [
      { id: 1, userId: empAId, entryDate: todayDateOnly(), stressLevel: 9, workHours: 9, sleepHours: 5, mood: "LOW", energyLevel: "LOW" },
      { id: 2, userId: empAId, entryDate: daysAgo(1), stressLevel: 8, workHours: 8, sleepHours: 5, mood: "LOW", energyLevel: "LOW" },
      { id: 3, userId: empBId, entryDate: todayDateOnly(), stressLevel: 2, workHours: 7, sleepHours: 8, mood: "GREAT", energyLevel: "HIGH" },
      { id: 4, userId: empCId, entryDate: daysAgo(2), stressLevel: 4, workHours: 6, sleepHours: 7, mood: "GOOD", energyLevel: "MEDIUM" },
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

async function importSummaryRoute() {
  vi.resetModules();
  process.env.BACKEND_URL = backendUrl;
  const mod = await import("../app/api/dashboard/summary/route.js");
  return mod.GET;
}

function req(url, cookie) {
  return new Request(url, { headers: cookie ? { cookie } : {} });
}

describe("frontend <-> real backend/src/app.js dashboard summary route (real Express app, frontend-owned fake, real sockets, no mocks)", () => {
  test("MANAGER: scope is forced to their own department even when scope=org&departmentId=<other> is requested", async () => {
    const GET = await importSummaryRoute();
    const cookie = `ewt_token=${token(30, "MANAGER", engineeringId)}`;

    const res = await GET(
      req(`http://localhost:3000/api/dashboard/summary?scope=org&departmentId=${salesId}`, cookie)
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.scope).toBe("department");
    expect(body.departmentId).toBe(engineeringId);
    // Only the 2 engineering employees are in scope, never Sales' Employee C.
    expect(body.kpiCards.find((c) => c.name === "Total Active Employees").value).toBe(2);
    expect(body.kpiCards.find((c) => c.name === "Submissions Today").value).toBe(2);
    expect(body.departmentWellnessScores).toEqual([
      expect.objectContaining({ departmentId: engineeringId, employeeCount: 2 }),
    ]);
  });

  test("MANAGER: Employee A (avg stress 8.5) ranks above Employee B in the top-high-stress list", async () => {
    const GET = await importSummaryRoute();
    const cookie = `ewt_token=${token(30, "MANAGER", engineeringId)}`;

    const res = await GET(req("http://localhost:3000/api/dashboard/summary", cookie));
    const body = await res.json();

    expect(body.topHighStressEmployees[0]).toEqual(
      expect.objectContaining({ employeeId: empAId, name: "Employee A", stressLevel: 8.5 })
    );
    expect(body.kpiCards.find((c) => c.name === "Employees Requiring Attention").value).toBe(1);
  });

  test("MANAGER: weekly trend has exactly 7 points, oldest first, with today's non-null score last", async () => {
    const GET = await importSummaryRoute();
    const cookie = `ewt_token=${token(30, "MANAGER", engineeringId)}`;

    const res = await GET(req("http://localhost:3000/api/dashboard/summary", cookie));
    const body = await res.json();

    expect(body.weeklyWellnessTrends).toHaveLength(7);
    expect(body.weeklyWellnessTrends[6].score).not.toBeNull();
  });

  test("ADMIN: scope=org sees all 3 employees across both departments", async () => {
    const GET = await importSummaryRoute();
    const cookie = `ewt_token=${token(99, "ADMIN", null)}`;

    const res = await GET(req("http://localhost:3000/api/dashboard/summary?scope=org", cookie));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.scope).toBe("org");
    expect(body.kpiCards.find((c) => c.name === "Total Active Employees").value).toBe(3);
    expect(body.departmentWellnessScores).toHaveLength(2);
  });

  test("ADMIN: scope=department&departmentId=<sales> is scoped to Sales only", async () => {
    const GET = await importSummaryRoute();
    const cookie = `ewt_token=${token(99, "ADMIN", null)}`;

    const res = await GET(
      req(`http://localhost:3000/api/dashboard/summary?scope=department&departmentId=${salesId}`, cookie)
    );
    const body = await res.json();

    expect(body.departmentId).toBe(salesId);
    expect(body.kpiCards.find((c) => c.name === "Total Active Employees").value).toBe(1);
  });

  test("ADMIN: a real 404 for an unknown departmentId", async () => {
    const GET = await importSummaryRoute();
    const cookie = `ewt_token=${token(99, "ADMIN", null)}`;

    const res = await GET(
      req("http://localhost:3000/api/dashboard/summary?scope=department&departmentId=999", cookie)
    );
    expect(res.status).toBe(404);
  });

  test("a real 400 when scope=department is requested with no departmentId", async () => {
    const GET = await importSummaryRoute();
    const cookie = `ewt_token=${token(99, "ADMIN", null)}`;

    const res = await GET(req("http://localhost:3000/api/dashboard/summary?scope=department", cookie));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.departmentId).toBeDefined();
  });

  test("without a session cookie: real 401 over the wire", async () => {
    const GET = await importSummaryRoute();
    const res = await GET(req("http://localhost:3000/api/dashboard/summary"));
    expect(res.status).toBe(401);
  });

  test("an EMPLOYEE session: real 403 over the wire", async () => {
    const GET = await importSummaryRoute();
    const cookie = `ewt_token=${token(empAId, "EMPLOYEE", engineeringId)}`;
    const res = await GET(req("http://localhost:3000/api/dashboard/summary", cookie));
    expect(res.status).toBe(403);
  });
});
