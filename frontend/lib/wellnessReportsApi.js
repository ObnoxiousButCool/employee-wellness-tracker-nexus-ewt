/**
 * Client-side fetch wrappers for the Manager/Admin `/api/wellness/*`
 * reporting BFF proxy routes (history grid, employee profile, trend chart).
 * Every function returns `{ ok, status, data }` instead of throwing on a
 * non-2xx response, matching the pattern used by wellnessApi.js/adminApi.js.
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

/** GET /api/wellness/history?userId=&department=&from=&to=&mood=&page=&pageSize=&sortBy=&sortOrder= */
export function fetchWellnessHistoryGrid({
  userId = "",
  department = "",
  from = "",
  to = "",
  mood = "",
  page = 1,
  pageSize = 20,
  sortBy = "entryDate",
  sortOrder = "desc",
} = {}) {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  if (department) params.set("department", department);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (mood) params.set("mood", mood);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  params.set("sortBy", sortBy);
  params.set("sortOrder", sortOrder);
  return request(`/api/wellness/history?${params.toString()}`);
}

/** GET /api/wellness/employees/:id/profile?from=&to= */
export function fetchEmployeeProfile(id, { from = "", to = "" } = {}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return request(`/api/wellness/employees/${id}/profile${qs ? `?${qs}` : ""}`);
}

/** GET /api/wellness/employees/:id/trend?metric=stress|sleep|energy&range=30d|90d */
export function fetchEmployeeTrend(id, { metric = "stress", range = "30d" } = {}) {
  const params = new URLSearchParams({ metric, range });
  return request(`/api/wellness/employees/${id}/trend?${params.toString()}`);
}
