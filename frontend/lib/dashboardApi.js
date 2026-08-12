/**
 * Client-side fetch wrapper for the `/api/dashboard/summary` BFF proxy
 * route. Returns `{ ok, status, data }` instead of throwing on a non-2xx
 * response, matching the pattern used by wellnessApi.js/wellnessReportsApi.js.
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

/** GET /api/dashboard/summary?scope=org|department&departmentId= */
export function fetchDashboardSummary({ scope = "org", departmentId = "" } = {}) {
  const params = new URLSearchParams();
  params.set("scope", scope);
  if (departmentId) params.set("departmentId", departmentId);
  return request(`/api/dashboard/summary?${params.toString()}`);
}
