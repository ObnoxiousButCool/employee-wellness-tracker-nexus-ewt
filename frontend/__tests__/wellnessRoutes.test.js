import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as entriesPOST } from "../app/api/wellness/entries/route";
import { GET as entriesMeGET } from "../app/api/wellness/entries/me/route";

function fakeBackendResponse({ status, body }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("POST /api/wellness/entries route handler (BFF proxy)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("forwards the body and cookie unchanged, relays the backend's 200 body", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({
        status: 200,
        body: { id: 1, userId: 5, entryDate: "2026-08-11", stressLevel: 5, workHours: 8, sleepHours: 7, mood: "GOOD", energyLevel: "HIGH" },
      })
    );

    const payload = { stressLevel: 5, workHours: 8, sleepHours: 7, mood: "GOOD", energyLevel: "HIGH" };
    const res = await entriesPOST(
      new Request("http://localhost:3000/api/wellness/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: "ewt_token=abc" },
        body: JSON.stringify(payload),
      })
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/wellness/entries",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ cookie: "ewt_token=abc" }),
        body: JSON.stringify(payload),
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(1);
  });

  test("relays a 422 field-error body unchanged", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({ status: 422, body: { errors: { stressLevel: "stressLevel must be an integer between 1 and 10" } } })
    );

    const res = await entriesPOST(
      new Request("http://localhost:3000/api/wellness/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stressLevel: 11 }),
      })
    );

    expect(res.status).toBe(422);
    expect((await res.json()).errors.stressLevel).toMatch(/between 1 and 10/);
  });

  test("returns 502 when the backend is unreachable", async () => {
    global.fetch.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const res = await entriesPOST(
      new Request("http://localhost:3000/api/wellness/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(res.status).toBe(502);
  });
});

describe("GET /api/wellness/entries/me route handler (BFF proxy)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("forwards the query string unchanged and relays the backend's list body", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 200, body: { data: [{ id: 1 }] } }));

    const res = await entriesMeGET(
      new Request("http://localhost:3000/api/wellness/entries/me?from=2026-08-01&to=2026-08-11", {
        headers: { cookie: "ewt_token=abc" },
      })
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/wellness/entries/me?from=2026-08-01&to=2026-08-11",
      expect.objectContaining({ method: "GET" })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toHaveLength(1);
  });

  test("relays a 401 when the backend rejects an unauthenticated request", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 401, body: { error: "Unauthorized" } }));

    const res = await entriesMeGET(new Request("http://localhost:3000/api/wellness/entries/me"));

    expect(res.status).toBe(401);
  });
});
