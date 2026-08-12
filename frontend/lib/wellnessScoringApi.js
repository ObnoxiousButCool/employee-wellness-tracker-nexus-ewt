/**
 * Client-side fetch wrappers for the S6 `/api/wellness/scores` and
 * `/api/departments/:departmentId/wellness/score` BFF proxy routes. Every
 * function returns `{ ok, status, data }` instead of throwing on a non-2xx
 * response, matching the pattern used by wellnessReportsApi.js/dashboardApi.js.
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

/** GET /api/wellness/scores?department= */
export function fetchWellnessScores({ department = "" } = {}) {
  const params = new URLSearchParams();
  if (department) params.set("department", department);
  const qs = params.toString();
  return request(`/api/wellness/scores${qs ? `?${qs}` : ""}`);
}

/** GET /api/departments/:departmentId/wellness/score */
export function fetchDepartmentWellnessScore(departmentId) {
  return request(`/api/departments/${departmentId}/wellness/score`);
}
