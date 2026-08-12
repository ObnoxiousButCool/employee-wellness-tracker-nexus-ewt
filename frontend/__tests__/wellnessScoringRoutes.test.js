import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET as scoresGET } from "../app/api/wellness/scores/route";
import { GET as departmentScoreGET } from "../app/api/departments/[departmentId]/wellness/score/route";

function fakeBackendResponse({ status, body }) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("GET /api/wellness/scores route handler (BFF proxy)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("forwards the query string unchanged and relays the backend's list body", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({ status: 200, body: { data: [{ employeeId: 1, score: 65, classificationCategory: "Stable" }] } })
    );

    const res = await scoresGET(
      new Request("http://localhost:3000/api/wellness/scores?department=2", {
        headers: { cookie: "ewt_token=abc" },
      })
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/wellness/scores?department=2",
      expect.objectContaining({ method: "GET", headers: expect.objectContaining({ cookie: "ewt_token=abc" }) })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toHaveLength(1);
  });

  test("relays a 400 for a malformed department filter", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 400, body: { errors: { department: "invalid" } } }));

    const res = await scoresGET(new Request("http://localhost:3000/api/wellness/scores?department=abc"));

    expect(res.status).toBe(400);
  });

  test("relays a 403 for an EMPLOYEE session", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 403, body: { error: "Forbidden" } }));

    const res = await scoresGET(new Request("http://localhost:3000/api/wellness/scores"));

    expect(res.status).toBe(403);
  });
});

describe("GET /api/departments/:departmentId/wellness/score route handler (BFF proxy)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("forwards the departmentId and relays the backend's score body", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 200, body: { departmentId: 3, score: 52 } }));

    const res = await departmentScoreGET(
      new Request("http://localhost:3000/api/departments/3/wellness/score", { headers: { cookie: "ewt_token=abc" } }),
      { params: { departmentId: "3" } }
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/departments/3/wellness/score",
      expect.objectContaining({ method: "GET" })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).score).toBe(52);
  });

  test("relays a 403 when a manager requests another department's score", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 403, body: { error: "Forbidden" } }));

    const res = await departmentScoreGET(new Request("http://localhost:3000/api/departments/9/wellness/score"), {
      params: { departmentId: "9" },
    });

    expect(res.status).toBe(403);
  });

  test("relays a 404 for an unknown department", async () => {
    global.fetch.mockResolvedValue(fakeBackendResponse({ status: 404, body: { error: "Department not found" } }));

    const res = await departmentScoreGET(new Request("http://localhost:3000/api/departments/999/wellness/score"), {
      params: { departmentId: "999" },
    });

    expect(res.status).toBe(404);
  });
});
