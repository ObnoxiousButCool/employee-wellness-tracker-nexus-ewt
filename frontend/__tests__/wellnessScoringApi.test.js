import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fetchWellnessScores, fetchDepartmentWellnessScore } from "../lib/wellnessScoringApi";

function fakeResponse({ ok, status, body }) {
  return { ok, status, json: async () => body };
}

describe("wellnessScoringApi client wrappers", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("fetchWellnessScores omits the query string when no department is given", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    await fetchWellnessScores();

    expect(global.fetch).toHaveBeenCalledWith("/api/wellness/scores", undefined);
  });

  test("fetchWellnessScores includes the department filter when given", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    await fetchWellnessScores({ department: "2" });

    expect(global.fetch).toHaveBeenCalledWith("/api/wellness/scores?department=2", undefined);
  });

  test("fetchDepartmentWellnessScore requests the department's score", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { departmentId: 3, score: 52 } }));

    await fetchDepartmentWellnessScore(3);

    expect(global.fetch).toHaveBeenCalledWith("/api/departments/3/wellness/score", undefined);
  });

  test("returns a network-error shape when fetch throws", async () => {
    global.fetch.mockRejectedValue(new Error("network down"));

    const result = await fetchWellnessScores();

    expect(result).toEqual({ ok: false, status: 0, data: { error: "Unable to reach the server. Please try again." } });
  });
});
