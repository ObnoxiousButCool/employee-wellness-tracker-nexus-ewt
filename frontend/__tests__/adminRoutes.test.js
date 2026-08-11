import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET as usersGET, POST as usersPOST } from "../app/api/admin/users/route";
import { PUT as userPUT } from "../app/api/admin/users/[id]/route";
import { PATCH as userStatusPATCH } from "../app/api/admin/users/[id]/status/route";
import { GET as departmentsGET, POST as departmentsPOST } from "../app/api/admin/departments/route";
import { PUT as departmentPUT } from "../app/api/admin/departments/[id]/route";

function fakeBackendResponse({ status, body }) {
  return { status, json: async () => body };
}

describe("/api/admin/* BFF proxy routes", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("GET /api/admin/users forwards the cookie and query string, relays status/body", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 200, body: { data: [], pagination: {} } }));

    const request = new Request("http://localhost:3000/api/admin/users?search=ann&page=2", {
      headers: { cookie: "ewt_token=abc" },
    });
    const res = await usersGET(request);

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/admin/users?search=ann&page=2",
      expect.objectContaining({ method: "GET", headers: { cookie: "ewt_token=abc" } })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [], pagination: {} });
  });

  test("GET /api/admin/users relays a 401 when the cookie is missing/invalid", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 401, body: { error: "Authentication required" } }));

    const res = await usersGET(new Request("http://localhost:3000/api/admin/users"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  test("GET /api/admin/users returns 502 when the backend is unreachable", async () => {
    global.fetch.mockRejectedValue(new Error("network down"));

    const res = await usersGET(new Request("http://localhost:3000/api/admin/users"));

    expect(res.status).toBe(502);
  });

  test("POST /api/admin/users forwards the cookie and body, relays a 409 conflict", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 409, body: { error: "Email is already in use" } }));

    const request = new Request("http://localhost:3000/api/admin/users", {
      method: "POST",
      headers: { cookie: "ewt_token=abc", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ann", email: "dup@ewt.test", password: "password1", roleId: 1 }),
    });
    const res = await usersPOST(request);

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/admin/users",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ cookie: "ewt_token=abc", "Content-Type": "application/json" }),
        body: JSON.stringify({ name: "Ann", email: "dup@ewt.test", password: "password1", roleId: 1 }),
      })
    );
    expect(res.status).toBe(409);
  });

  test("PUT /api/admin/users/:id forwards the id in the backend path", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 200, body: { id: 5, name: "Ann B." } }));

    const request = new Request("http://localhost:3000/api/admin/users/5", {
      method: "PUT",
      headers: { cookie: "ewt_token=abc" },
      body: JSON.stringify({ name: "Ann B." }),
    });
    const res = await userPUT(request, { params: { id: "5" } });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/admin/users/5",
      expect.objectContaining({ method: "PUT" })
    );
    expect(res.status).toBe(200);
  });

  test("PATCH /api/admin/users/:id/status forwards the id and isActive body", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 200, body: { id: 5, isActive: false } }));

    const request = new Request("http://localhost:3000/api/admin/users/5/status", {
      method: "PATCH",
      headers: { cookie: "ewt_token=abc" },
      body: JSON.stringify({ isActive: false }),
    });
    const res = await userStatusPATCH(request, { params: { id: "5" } });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/admin/users/5/status",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ isActive: false }) })
    );
    expect(res.status).toBe(200);
  });

  test("GET /api/admin/departments forwards the cookie and query string", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 200, body: { data: [] } }));

    const request = new Request("http://localhost:3000/api/admin/departments?status=active", {
      headers: { cookie: "ewt_token=abc" },
    });
    const res = await departmentsGET(request);

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/admin/departments?status=active",
      expect.objectContaining({ method: "GET" })
    );
    expect(res.status).toBe(200);
  });

  test("POST /api/admin/departments relays a 409 name conflict", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({ status: 409, body: { error: "Department name is already in use" } })
    );

    const request = new Request("http://localhost:3000/api/admin/departments", {
      method: "POST",
      headers: { cookie: "ewt_token=abc" },
      body: JSON.stringify({ name: "HR" }),
    });
    const res = await departmentsPOST(request);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Department name is already in use" });
  });

  test("PUT /api/admin/departments/:id forwards the id and body (rename or status toggle)", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({ status: 200, body: { id: 2, name: "HR", isActive: false, activeUserCount: 3 } })
    );

    const request = new Request("http://localhost:3000/api/admin/departments/2", {
      method: "PUT",
      headers: { cookie: "ewt_token=abc" },
      body: JSON.stringify({ isActive: false }),
    });
    const res = await departmentPUT(request, { params: { id: "2" } });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/admin/departments/2",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ isActive: false }) })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 2, name: "HR", isActive: false, activeUserCount: 3 });
  });
});
