import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET as summaryGET } from "../app/api/dashboard/summary/route";

function fakeBackendResponse({ status, body }) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("GET /api/dashboard/summary route handler (BFF proxy)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("forwards the query string unchanged and relays the backend's summary body", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({ status: 200, body: { scope: "org", kpiCards: [] } })
    );

    const res = await summaryGET(
      new Request("http://localhost:3000/api/dashboard/summary?scope=department&departmentId=3", {
        headers: { cookie: "ewt_token=abc" },
      })
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/dashboard/summary?scope=department&departmentId=3",
      expect.objectContaining({ method: "GET", headers: expect.objectContaining({ cookie: "ewt_token=abc" }) })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).scope).toBe("org");
  });

  test("relays a 403 for an EMPLOYEE session", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 403, body: { error: "Forbidden" } }));

    const res = await summaryGET(new Request("http://localhost:3000/api/dashboard/summary"));

    expect(res.status).toBe(403);
  });

  test("relays a 404 for an unknown departmentId", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 404, body: { error: "Department not found" } }));

    const res = await summaryGET(
      new Request("http://localhost:3000/api/dashboard/summary?scope=department&departmentId=999")
    );

    expect(res.status).toBe(404);
  });
});
