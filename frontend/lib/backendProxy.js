const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

/**
 * Shared relay used by BFF route handlers: forwards the inbound request's
 * `ewt_token` cookie to the backend (same-origin cookie forwarding pattern
 * established in S1's auth proxies), optionally forwards the JSON body, and
 * returns the backend's status/body unchanged so the route handler can pass
 * it straight through with `NextResponse.json`.
 * @param {Request} request
 * @param {{method: string, path: string, forwardBody?: boolean}} options
 * @returns {Promise<{status: number, data: any}>}
 */
export async function proxyToBackend(request, { method, path, forwardBody = false }) {
  const headers = { cookie: request.headers.get("cookie") || "" };
  let body;
  if (forwardBody) {
    body = await request.text();
    headers["Content-Type"] = "application/json";
  }

  let backendRes;
  try {
    backendRes = await fetch(`${BACKEND_URL}${path}`, { method, headers, body });
  } catch {
    return { status: 502, data: { error: "Unable to reach the wellness service" } };
  }

  const data = await backendRes.json().catch(() => ({}));
  return { status: backendRes.status, data };
}
