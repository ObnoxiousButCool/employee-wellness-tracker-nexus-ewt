import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { startFakeAdminBackend, adminToken } from "./helpers/fakeAdminBackend";

/**
 * Real network, real sockets, real code — no mocked `fetch`, no backend
 * internals imported (see `helpers/fakeAdminBackend.js` for why). The
 * frontend's actual `/api/admin/users*` route handlers are driven against a
 * contract-accurate stand-in server over a real TCP socket with a real
 * signed `ewt_token` cookie.
 */

let backend;

beforeAll(async () => {
  backend = await startFakeAdminBackend();
});

afterAll(() => {
  backend.server.close();
});

async function importUserRouteHandlers() {
  vi.resetModules();
  process.env.BACKEND_URL = backend.baseUrl;
  const users = await import("./../app/api/admin/users/route.js");
  const userById = await import("./../app/api/admin/users/[id]/route.js");
  const userStatus = await import("./../app/api/admin/users/[id]/status/route.js");
  return { users, userById, userStatus };
}

function req(path, init = {}) {
  return new Request(`${backend.baseUrl}${path}`, {
    ...init,
    headers: { cookie: `ewt_token=${adminToken()}`, ...(init.headers || {}) },
  });
}

describe("frontend <-> live admin users contract server (real sockets, no mocks)", () => {
  test("GET /api/admin/users lists the seeded admin with role/department resolved, no passwordHash", async () => {
    const { users } = await importUserRouteHandlers();

    const res = await users.GET(req("/api/admin/users"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ id: 1, name: "Seed Admin", role: "ADMIN", department: "Engineering" });
    expect(body.data[0].passwordHash).toBeUndefined();
  });

  test("GET /api/admin/users returns a real 401 from authenticate when the cookie is missing", async () => {
    const { users } = await importUserRouteHandlers();

    const res = await users.GET(new Request(`${backend.baseUrl}/api/admin/users`));

    expect(res.status).toBe(401);
  });

  test("POST /api/admin/users creates a user, then a duplicate email gets a real 409", async () => {
    const { users } = await importUserRouteHandlers();

    const createRes = await users.POST(
      req("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name: "New Hire", email: "new-hire@ewt.test", password: "password1", roleId: 3 }),
      })
    );
    expect(createRes.status).toBe(201);
    expect((await createRes.json()).name).toBe("New Hire");

    const dupRes = await users.POST(
      req("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name: "Someone Else", email: "new-hire@ewt.test", password: "password1", roleId: 3 }),
      })
    );
    expect(dupRes.status).toBe(409);
    expect(await dupRes.json()).toEqual({ error: "Email is already in use" });
  });

  test("PUT /api/admin/users/:id edits a user for real", async () => {
    const { userById } = await importUserRouteHandlers();

    const res = await userById.PUT(
      req("/api/admin/users/1", { method: "PUT", body: JSON.stringify({ name: "Renamed Admin" }) }),
      { params: { id: "1" } }
    );

    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("Renamed Admin");
  });

  test("PATCH /api/admin/users/:id/status deactivates then reactivates a user for real", async () => {
    const { userStatus } = await importUserRouteHandlers();

    const deactivateRes = await userStatus.PATCH(
      req("/api/admin/users/1/status", { method: "PATCH", body: JSON.stringify({ isActive: false }) }),
      { params: { id: "1" } }
    );
    expect(deactivateRes.status).toBe(200);
    expect((await deactivateRes.json()).isActive).toBe(false);

    const reactivateRes = await userStatus.PATCH(
      req("/api/admin/users/1/status", { method: "PATCH", body: JSON.stringify({ isActive: true }) }),
      { params: { id: "1" } }
    );
    expect(reactivateRes.status).toBe(200);
    expect((await reactivateRes.json()).isActive).toBe(true);
  });
});
