/**
 * Client-side fetch wrappers for the `/api/wellness/*` BFF proxy routes.
 * Every function returns `{ ok, status, data }` instead of throwing on a
 * non-2xx response, so callers can show the backend's exact field-level
 * error messages (e.g. a 422 validation body) without a try/catch at every
 * call site.
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

/** POST /api/wellness/entries */
export function submitWellnessEntry(payload) {
  return request("/api/wellness/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** GET /api/wellness/entries/me?from=&to= */
export function fetchWellnessHistory({ from = "", to = "" } = {}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return request(`/api/wellness/entries/me${qs ? `?${qs}` : ""}`);
}
