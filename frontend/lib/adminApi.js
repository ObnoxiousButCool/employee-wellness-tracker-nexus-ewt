/**
 * Client-side fetch wrappers for the `/api/admin/*` BFF proxy routes. Every
 * function returns `{ ok, status, data }` instead of throwing on a non-2xx
 * response, so callers can show the backend's exact error message (e.g. a
 * 409 email/name conflict) without a try/catch at every call site.
 */

async function request(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    return { ok: false, status: 0, data: { error: "Unable to reach the server. Please try again." } };
  }
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function jsonBody(payload) {
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

/** GET /api/admin/users?search=&department=&status=&page=&pageSize= */
export function fetchUsers({ search = "", department = "", status = "", page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (department) params.set("department", department);
  if (status) params.set("status", status);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return request(`/api/admin/users?${params.toString()}`);
}

/** POST /api/admin/users */
export function createUser(payload) {
  return request("/api/admin/users", { method: "POST", ...jsonBody(payload) });
}

/** PUT /api/admin/users/:id */
export function updateUser(id, payload) {
  return request(`/api/admin/users/${id}`, { method: "PUT", ...jsonBody(payload) });
}

/** PATCH /api/admin/users/:id/status */
export function setUserStatus(id, isActive) {
  return request(`/api/admin/users/${id}/status`, { method: "PATCH", ...jsonBody({ isActive }) });
}

/** GET /api/admin/departments?status= */
export function fetchDepartments({ status = "" } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const qs = params.toString();
  return request(`/api/admin/departments${qs ? `?${qs}` : ""}`);
}

/** POST /api/admin/departments */
export function createDepartment(payload) {
  return request("/api/admin/departments", { method: "POST", ...jsonBody(payload) });
}

/** PUT /api/admin/departments/:id */
export function updateDepartment(id, payload) {
  return request(`/api/admin/departments/${id}`, { method: "PUT", ...jsonBody(payload) });
}
