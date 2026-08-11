import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  fetchUsers,
  createUser,
  updateUser,
  setUserStatus,
  fetchDepartments,
  createDepartment,
  updateDepartment,
} from "../lib/adminApi";

function fakeResponse({ ok, status, body }) {
  return { ok, status, json: async () => body };
}

describe("lib/adminApi fetch wrappers", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("fetchUsers builds the query string with search/department/status/page/pageSize", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [], pagination: {} } }));

    await fetchUsers({ search: "ann", department: "3", status: "active", page: 2, pageSize: 10 });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/admin/users?search=ann&department=3&status=active&page=2&pageSize=10");
  });

  test("fetchUsers omits empty filters and defaults page/pageSize", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [], pagination: {} } }));

    await fetchUsers();

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/admin/users?page=1&pageSize=20");
  });

  test("createUser POSTs JSON to /api/admin/users", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 201, body: { id: 1 } }));

    const result = await createUser({ name: "Ann", email: "ann@ewt.test", password: "password1", roleId: 3 });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/users",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ann", email: "ann@ewt.test", password: "password1", roleId: 3 }),
      })
    );
    expect(result).toEqual({ ok: true, status: 201, data: { id: 1 } });
  });

  test("createUser surfaces a non-2xx response as ok:false without throwing", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: false, status: 409, body: { error: "Email is already in use" } }));

    const result = await createUser({ name: "Ann", email: "dup@ewt.test", password: "password1", roleId: 3 });

    expect(result).toEqual({ ok: false, status: 409, data: { error: "Email is already in use" } });
  });

  test("createUser reports a network failure without throwing", async () => {
    global.fetch.mockRejectedValue(new Error("network down"));

    const result = await createUser({ name: "Ann", email: "ann@ewt.test", password: "password1", roleId: 3 });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.data.error).toMatch(/unable to reach/i);
  });

  test("updateUser PUTs JSON to /api/admin/users/:id", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { id: 5 } }));

    await updateUser(5, { name: "Ann B." });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/users/5",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ name: "Ann B." }) })
    );
  });

  test("setUserStatus PATCHes /api/admin/users/:id/status with isActive", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { id: 5, isActive: false } }));

    await setUserStatus(5, false);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/users/5/status",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ isActive: false }) })
    );
  });

  test("fetchDepartments omits the query string when status is not provided", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    await fetchDepartments();

    expect(global.fetch).toHaveBeenCalledWith("/api/admin/departments", undefined);
  });

  test("fetchDepartments includes ?status= when provided", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    await fetchDepartments({ status: "inactive" });

    expect(global.fetch).toHaveBeenCalledWith("/api/admin/departments?status=inactive", undefined);
  });

  test("createDepartment POSTs JSON to /api/admin/departments", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 201, body: { id: 1, name: "HR" } }));

    const result = await createDepartment({ name: "HR" });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/departments",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "HR" }) })
    );
    expect(result).toEqual({ ok: true, status: 201, data: { id: 1, name: "HR" } });
  });

  test("updateDepartment PUTs JSON to /api/admin/departments/:id", async () => {
    global.fetch.mockResolvedValue(
      fakeResponse({ ok: true, status: 200, body: { id: 1, name: "HR", isActive: false } })
    );

    await updateDepartment(1, { isActive: false });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/departments/1",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ isActive: false }) })
    );
  });
});
