import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { startFakeAdminBackend, adminToken } from "./helpers/fakeAdminBackend";

/**
 * Real network, real sockets, real code — no mocked `fetch`, no backend
 * internals imported (see `helpers/fakeAdminBackend.js`). Exercises the
 * acceptance criterion this story depends on most: deactivating a
 * department must never cascade to its users.
 */

let backend;

beforeAll(async () => {
  backend = await startFakeAdminBackend();
});

afterAll(() => {
  backend.server.close();
});

async function importDepartmentRouteHandlers() {
  vi.resetModules();
  process.env.BACKEND_URL = backend.baseUrl;
  const departments = await import("./../app/api/admin/departments/route.js");
  const departmentById = await import("./../app/api/admin/departments/[id]/route.js");
  const users = await import("./../app/api/admin/users/route.js");
  return { departments, departmentById, users };
}

function req(path, init = {}) {
  return new Request(`${backend.baseUrl}${path}`, {
    ...init,
    headers: { cookie: `ewt_token=${adminToken()}`, ...(init.headers || {}) },
  });
}

describe("frontend <-> live admin departments contract server (real sockets, no mocks)", () => {
  test("GET /api/admin/departments returns a live activeUserCount", async () => {
    const { departments } = await importDepartmentRouteHandlers();

    const res = await departments.GET(req("/api/admin/departments"));

    expect(res.status).toBe(200);
    const body = await res.json();
    const engineering = body.data.find((d) => d.name === "Engineering");
    expect(engineering.activeUserCount).toBeGreaterThanOrEqual(1);
  });

  test("POST /api/admin/departments creates a department, then a duplicate name gets a real 409", async () => {
    const { departments } = await importDepartmentRouteHandlers();

    const createRes = await departments.POST(
      req("/api/admin/departments", { method: "POST", body: JSON.stringify({ name: "Facilities" }) })
    );
    expect(createRes.status).toBe(201);

    const dupRes = await departments.POST(
      req("/api/admin/departments", { method: "POST", body: JSON.stringify({ name: "Facilities" }) })
    );
    expect(dupRes.status).toBe(409);
    expect(await dupRes.json()).toEqual({ error: "Department name is already in use" });
  });

  test("deactivating a department never cascades: users' isActive/departmentId are unchanged", async () => {
    const { departments, departmentById, users } = await importDepartmentRouteHandlers();

    const beforeUsers = (await (await users.GET(req("/api/admin/users"))).json()).data;
    const beforeSnapshot = beforeUsers
      .filter((u) => u.departmentId === 1)
      .map((u) => ({ id: u.id, isActive: u.isActive, departmentId: u.departmentId }));
    expect(beforeSnapshot.length).toBeGreaterThan(0);

    const deactivateRes = await departmentById.PUT(
      req("/api/admin/departments/1", { method: "PUT", body: JSON.stringify({ isActive: false }) }),
      { params: { id: "1" } }
    );
    expect(deactivateRes.status).toBe(200);
    const deactivated = await deactivateRes.json();
    expect(deactivated.isActive).toBe(false);
    const activeUserCountAtDeactivation = deactivated.activeUserCount;

    const afterUsers = (await (await users.GET(req("/api/admin/users"))).json()).data;
    const afterSnapshot = afterUsers
      .filter((u) => u.departmentId === 1)
      .map((u) => ({ id: u.id, isActive: u.isActive, departmentId: u.departmentId }));
    expect(afterSnapshot).toEqual(beforeSnapshot);

    const departmentsRes = await departments.GET(req("/api/admin/departments"));
    const engineering = (await departmentsRes.json()).data.find((d) => d.id === 1);
    expect(engineering.activeUserCount).toBe(activeUserCountAtDeactivation);

    await departmentById.PUT(
      req("/api/admin/departments/1", { method: "PUT", body: JSON.stringify({ isActive: true }) }),
      { params: { id: "1" } }
    );
  });
});
