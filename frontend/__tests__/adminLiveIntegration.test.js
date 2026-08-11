import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import http from "node:http";
import jwt from "jsonwebtoken";

/**
 * Real backend, real sockets, real code — no mocked `fetch`, no stand-in
 * server. Imports the backend's actual Express app (`backend/src/app.js`
 * via `createApp`) and starts it on a real ephemeral localhost port, wired
 * to the backend's own in-memory Prisma fake (`backend/tests/helpers/
 * fakePrisma.js`) since no live Postgres is available in this environment
 * (the same constraint the backend layer hit in its own test suite). The
 * frontend's actual `/api/admin/*` route handlers are then driven against
 * that real server over a real TCP socket with a real signed `ewt_token`
 * cookie, exercising every endpoint in the S2 API Contract end to end,
 * including the "no cascade" guarantee the deactivation-warning UI relies
 * on: deactivating a department must leave its users' isActive/departmentId
 * untouched.
 *
 * There is currently no POST /api/auth/login on the backend (see the API
 * Contract gap noted in PROJECT_CONTEXT.md), so the admin token below is
 * minted directly with `jsonwebtoken` using the same JWT_SECRET/claims
 * shape `authenticate.js` verifies — identical to how the backend's own
 * `tests/helpers/testApp.js` mints its test tokens.
 */

const TEST_JWT_SECRET = "admin-live-integration-test-secret";
process.env.JWT_SECRET = TEST_JWT_SECRET;

const SEED_ROLES = [
  { id: 1, name: "ADMIN" },
  { id: 2, name: "MANAGER" },
  { id: 3, name: "EMPLOYEE" },
];
const SEED_DEPARTMENTS = [{ id: 1, name: "Engineering", isActive: true }];
const SEED_USERS = [
  {
    id: 1,
    name: "Seed Admin",
    email: "seed-admin@ewt.test",
    passwordHash: "irrelevant-for-this-test",
    roleId: 1,
    departmentId: 1,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

function adminToken() {
  return jwt.sign({ userId: 1, role: "ADMIN", departmentId: 1 }, TEST_JWT_SECRET, { expiresIn: "8h" });
}

let backendServer;
let backendUrl;

beforeAll(async () => {
  // Fresh require of the backend's real app + fake Prisma, seeded once for this file.
  const createApp = require("../../backend/src/app");
  const { createFakePrisma } = require("../../backend/tests/helpers/fakePrisma");
  const prisma = createFakePrisma({ roles: SEED_ROLES, departments: SEED_DEPARTMENTS, users: SEED_USERS });
  const app = createApp({ prisma });

  await new Promise((resolve) => {
    backendServer = http.createServer(app).listen(0, "127.0.0.1", resolve);
  });
  backendUrl = `http://127.0.0.1:${backendServer.address().port}`;
});

afterAll(() => {
  backendServer.close();
});

async function importAdminRouteHandlers() {
  vi.resetModules();
  process.env.BACKEND_URL = backendUrl;
  const users = await import("../app/api/admin/users/route.js");
  const userById = await import("../app/api/admin/users/[id]/route.js");
  const userStatus = await import("../app/api/admin/users/[id]/status/route.js");
  const departments = await import("../app/api/admin/departments/route.js");
  const departmentById = await import("../app/api/admin/departments/[id]/route.js");
  return { users, userById, userStatus, departments, departmentById };
}

function req(url, init = {}) {
  return new Request(url, {
    ...init,
    headers: { cookie: `ewt_token=${adminToken()}`, ...(init.headers || {}) },
  });
}

describe("frontend <-> live backend Express app (real sockets, real Prisma fake, no mocks)", () => {
  test("GET /api/admin/users lists the seeded admin with role/department resolved, no passwordHash", async () => {
    const { users } = await importAdminRouteHandlers();

    const res = await users.GET(req(`${backendUrl}/api/admin/users`));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: 1,
      name: "Seed Admin",
      role: "ADMIN",
      department: "Engineering",
    });
    expect(body.data[0].passwordHash).toBeUndefined();
  });

  test("GET /api/admin/users returns a real 401 from authenticate when the cookie is missing", async () => {
    const { users } = await importAdminRouteHandlers();

    const res = await users.GET(new Request(`${backendUrl}/api/admin/users`));

    expect(res.status).toBe(401);
  });

  test("POST /api/admin/users creates a user, then a duplicate email gets a real 409", async () => {
    const { users } = await importAdminRouteHandlers();

    const createRes = await users.POST(
      req(`${backendUrl}/api/admin/users`, {
        method: "POST",
        body: JSON.stringify({ name: "New Hire", email: "new-hire@ewt.test", password: "password1", roleId: 3 }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.name).toBe("New Hire");

    const dupRes = await users.POST(
      req(`${backendUrl}/api/admin/users`, {
        method: "POST",
        body: JSON.stringify({ name: "Someone Else", email: "new-hire@ewt.test", password: "password1", roleId: 3 }),
      })
    );
    expect(dupRes.status).toBe(409);
    expect(await dupRes.json()).toEqual({ error: "Email is already in use" });
  });

  test("PUT /api/admin/users/:id edits a user for real", async () => {
    const { userById } = await importAdminRouteHandlers();

    const res = await userById.PUT(
      req(`${backendUrl}/api/admin/users/1`, { method: "PUT", body: JSON.stringify({ name: "Renamed Admin" }) }),
      { params: { id: "1" } }
    );

    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("Renamed Admin");
  });

  test("PATCH /api/admin/users/:id/status deactivates then reactivates a user for real", async () => {
    const { userStatus } = await importAdminRouteHandlers();

    const deactivateRes = await userStatus.PATCH(
      req(`${backendUrl}/api/admin/users/1/status`, { method: "PATCH", body: JSON.stringify({ isActive: false }) }),
      { params: { id: "1" } }
    );
    expect(deactivateRes.status).toBe(200);
    expect((await deactivateRes.json()).isActive).toBe(false);

    const reactivateRes = await userStatus.PATCH(
      req(`${backendUrl}/api/admin/users/1/status`, { method: "PATCH", body: JSON.stringify({ isActive: true }) }),
      { params: { id: "1" } }
    );
    expect(reactivateRes.status).toBe(200);
    expect((await reactivateRes.json()).isActive).toBe(true);
  });

  test("GET /api/admin/departments returns a live activeUserCount", async () => {
    const { departments } = await importAdminRouteHandlers();

    const res = await departments.GET(req(`${backendUrl}/api/admin/departments`));

    expect(res.status).toBe(200);
    const body = await res.json();
    const engineering = body.data.find((d) => d.name === "Engineering");
    expect(engineering.activeUserCount).toBeGreaterThanOrEqual(1);
  });

  test("POST /api/admin/departments creates a department, then a duplicate name gets a real 409", async () => {
    const { departments } = await importAdminRouteHandlers();

    const createRes = await departments.POST(
      req(`${backendUrl}/api/admin/departments`, { method: "POST", body: JSON.stringify({ name: "Facilities" }) })
    );
    expect(createRes.status).toBe(201);

    const dupRes = await departments.POST(
      req(`${backendUrl}/api/admin/departments`, { method: "POST", body: JSON.stringify({ name: "Facilities" }) })
    );
    expect(dupRes.status).toBe(409);
    expect(await dupRes.json()).toEqual({ error: "Department name is already in use" });
  });

  test("deactivating a department never cascades: activeUserCount and the department's users are unchanged", async () => {
    const { departments, departmentById, users } = await importAdminRouteHandlers();

    const beforeUsersRes = await users.GET(req(`${backendUrl}/api/admin/users?department=1`));
    const beforeUsers = (await beforeUsersRes.json()).data;
    expect(beforeUsers.length).toBeGreaterThan(0);
    const beforeSnapshot = beforeUsers.map((u) => ({ id: u.id, isActive: u.isActive, departmentId: u.departmentId }));

    const deactivateRes = await departmentById.PUT(
      req(`${backendUrl}/api/admin/departments/1`, { method: "PUT", body: JSON.stringify({ isActive: false }) }),
      { params: { id: "1" } }
    );
    expect(deactivateRes.status).toBe(200);
    const deactivated = await deactivateRes.json();
    expect(deactivated.isActive).toBe(false);
    const activeUserCountAtDeactivation = deactivated.activeUserCount;

    const afterUsersRes = await users.GET(req(`${backendUrl}/api/admin/users?department=1`));
    const afterUsers = (await afterUsersRes.json()).data;
    const afterSnapshot = afterUsers.map((u) => ({ id: u.id, isActive: u.isActive, departmentId: u.departmentId }));
    expect(afterSnapshot).toEqual(beforeSnapshot);

    const departmentsRes = await departments.GET(req(`${backendUrl}/api/admin/departments`));
    const engineering = (await departmentsRes.json()).data.find((d) => d.id === 1);
    expect(engineering.activeUserCount).toBe(activeUserCountAtDeactivation);

    // Restore state for any tests that might run after this one in the same file.
    await departmentById.PUT(
      req(`${backendUrl}/api/admin/departments/1`, { method: "PUT", body: JSON.stringify({ isActive: true }) }),
      { params: { id: "1" } }
    );
  });
});
