import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

/**
 * Genuine live-backend verification for the S4 Manager/Admin wellness
 * reporting endpoints (`/api/wellness/history`,
 * `/api/wellness/employees/:id/profile`, `/api/wellness/employees/:id/trend`).
 * Boots the REAL `backend/src/app.js`, wired to the backend's own
 * `tests/helpers/fakePrisma.js` in-memory double (no live Postgres in this
 * environment), over a real TCP socket, and drives the frontend's actual
 * `/api/wellness/*` BFF route handlers against it — no mocked `fetch`, no
 * re-implementation of backend logic. Follows the same pattern as
 * `adminLiveBackendVerification.test.js`.
 *
 * `backend/` is a sibling layer; this branch was cut from `story-s4-backend`
 * so it is present here, but the suite still skips cleanly (rather than
 * failing CI) if `backend/src` is ever absent.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendAppPath = path.resolve(__dirname, "../../backend/src/app.js");
const backendAvailable = fs.existsSync(backendAppPath);

describe.skipIf(!backendAvailable)(
  "frontend <-> REAL backend/src/app.js wellness reporting routes (real Express app, real fakePrisma double, real sockets, no mocks)",
  () => {
    let server;
    let baseUrl;
    let managerToken;
    let otherManagerToken;
    let adminToken;
    let employeeAId;
    let employeeBId;

    beforeAll(async () => {
      const require = createRequire(import.meta.url);
      const createApp = require(backendAppPath);
      const { createFakePrisma } = require(path.resolve(__dirname, "../../backend/tests/helpers/fakePrisma.js"));
      const jwt = require("jsonwebtoken");

      employeeAId = 10;
      employeeBId = 20;

      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      const prisma = createFakePrisma({
        roles: [
          { id: 1, name: "ADMIN" },
          { id: 2, name: "MANAGER" },
          { id: 3, name: "EMPLOYEE" },
        ],
        departments: [
          { id: 1, name: "Engineering", isActive: true },
          { id: 2, name: "Sales", isActive: true },
        ],
        users: [
          { id: 1, name: "Manny Manager", email: "manny@ewt.test", passwordHash: "x", roleId: 2, departmentId: 1, isActive: true },
          { id: 2, name: "Other Manager", email: "other@ewt.test", passwordHash: "x", roleId: 2, departmentId: 2, isActive: true },
          { id: 3, name: "Ann Admin", email: "ann@ewt.test", passwordHash: "x", roleId: 1, departmentId: null, isActive: true },
          { id: employeeAId, name: "Employee A", email: "a@ewt.test", passwordHash: "x", roleId: 3, departmentId: 1, isActive: true },
          { id: employeeBId, name: "Employee B", email: "b@ewt.test", passwordHash: "x", roleId: 3, departmentId: 2, isActive: true },
        ],
        wellnessEntries: [
          { id: 1, userId: employeeAId, entryDate: yesterday, stressLevel: 3, workHours: 8, sleepHours: 7, mood: "GOOD", energyLevel: "HIGH" },
          { id: 2, userId: employeeAId, entryDate: today, stressLevel: 7, workHours: 9, sleepHours: 5, mood: "LOW", energyLevel: "LOW" },
          { id: 3, userId: employeeBId, entryDate: today, stressLevel: 2, workHours: 6, sleepHours: 8, mood: "GREAT", energyLevel: "VERY_HIGH" },
        ],
      });
      const app = createApp({ prisma });

      server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      baseUrl = `http://127.0.0.1:${server.address().port}`;

      managerToken = jwt.sign({ userId: 1, role: "MANAGER", departmentId: 1 }, process.env.JWT_SECRET, { expiresIn: "8h" });
      otherManagerToken = jwt.sign({ userId: 2, role: "MANAGER", departmentId: 2 }, process.env.JWT_SECRET, { expiresIn: "8h" });
      adminToken = jwt.sign({ userId: 3, role: "ADMIN", departmentId: null }, process.env.JWT_SECRET, { expiresIn: "8h" });
      process.env.BACKEND_URL = baseUrl;
    });

    afterAll(() => {
      server?.close();
    });

    function req(path_, token, init = {}) {
      return new Request(`${baseUrl}${path_}`, {
        ...init,
        headers: { cookie: `ewt_token=${token}`, ...(init.headers || {}) },
      });
    }

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
      const body = await res.json();
      const stressLevels = body.data.map((r) => r.stressLevel);
      expect(stressLevels).toEqual([...stressLevels].sort((a, b) => a - b));
    });

    test("GET /api/wellness/history (BFF) is 403 for a session without ADMIN/MANAGER role", async () => {
      const jwt = createRequire(import.meta.url)("jsonwebtoken");
      const employeeSessionToken = jwt.sign({ userId: employeeAId, role: "EMPLOYEE", departmentId: 1 }, process.env.JWT_SECRET, { expiresIn: "8h" });
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
  }
);
