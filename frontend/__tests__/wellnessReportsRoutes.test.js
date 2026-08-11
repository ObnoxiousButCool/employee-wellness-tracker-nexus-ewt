import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET as historyGET } from "../app/api/wellness/history/route";
import { GET as profileGET } from "../app/api/wellness/employees/[id]/profile/route";
import { GET as trendGET } from "../app/api/wellness/employees/[id]/trend/route";

function fakeBackendResponse({ status, body }) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("GET /api/wellness/history route handler (BFF proxy)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("forwards the query string unchanged and relays the backend's list body", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({ status: 200, body: { data: [{ id: 1 }], pagination: { page: 1 } } })
    );

    const res = await historyGET(
      new Request("http://localhost:3000/api/wellness/history?page=1&pageSize=20&sortBy=entryDate&sortOrder=desc", {
        headers: { cookie: "ewt_token=abc" },
      })
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/wellness/history?page=1&pageSize=20&sortBy=entryDate&sortOrder=desc",
      expect.objectContaining({ method: "GET", headers: expect.objectContaining({ cookie: "ewt_token=abc" }) })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toHaveLength(1);
  });

  test("relays a 403 for an EMPLOYEE session", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 403, body: { error: "Forbidden" } }));

    const res = await historyGET(new Request("http://localhost:3000/api/wellness/history"));

    expect(res.status).toBe(403);
  });
});

describe("GET /api/wellness/employees/:id/profile route handler (BFF proxy)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("forwards the id and query string, relays the backend's profile body", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({
        status: 200,
        body: { id: 7, name: "Ann", departmentId: 2, range: { from: "2026-07-12", to: "2026-08-11" }, stats: {} },
      })
    );

    const res = await profileGET(
      new Request("http://localhost:3000/api/wellness/employees/7/profile", { headers: { cookie: "ewt_token=abc" } }),
      { params: { id: "7" } }
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/wellness/employees/7/profile",
      expect.objectContaining({ method: "GET" })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("Ann");
  });

  test("relays a 403 when a manager reaches an employee outside their department", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 403, body: { error: "Forbidden" } }));

    const res = await profileGET(new Request("http://localhost:3000/api/wellness/employees/9/profile"), {
      params: { id: "9" },
    });

    expect(res.status).toBe(403);
  });

  test("relays a 404 for a missing employee", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 404, body: { error: "Employee not found" } }));

    const res = await profileGET(new Request("http://localhost:3000/api/wellness/employees/999/profile"), {
      params: { id: "999" },
    });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/wellness/employees/:id/trend route handler (BFF proxy)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("forwards the id and metric/range query string, relays the backend's series body", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({ status: 200, body: { data: [{ date: "2026-08-01", value: 5 }] } })
    );

    const res = await trendGET(
      new Request("http://localhost:3000/api/wellness/employees/7/trend?metric=stress&range=30d"),
      { params: { id: "7" } }
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/wellness/employees/7/trend?metric=stress&range=30d",
      expect.objectContaining({ method: "GET" })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toHaveLength(1);
  });

  test("relays a 400 for an invalid metric/range", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({ status: 400, body: { errors: { metric: "metric must be one of: stress, sleep, energy" } } })
    );

    const res = await trendGET(
      new Request("http://localhost:3000/api/wellness/employees/7/trend?metric=bad&range=30d"),
      { params: { id: "7" } }
    );

    expect(res.status).toBe(400);
  });
});
