import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fetchWellnessHistoryGrid, fetchEmployeeProfile, fetchEmployeeTrend } from "../lib/wellnessReportsApi";

function fakeResponse({ ok, status, body }) {
  return { ok, status, json: async () => body };
}

describe("wellnessReportsApi client wrappers", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("fetchWellnessHistoryGrid builds the full query string with defaults", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    await fetchWellnessHistoryGrid();

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/wellness/history?page=1&pageSize=20&sortBy=entryDate&sortOrder=desc",
      undefined
    );
  });

  test("fetchWellnessHistoryGrid includes optional filters when provided", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    await fetchWellnessHistoryGrid({
      userId: "5",
      department: "2",
      from: "2026-08-01",
      to: "2026-08-11",
      mood: "GOOD",
      page: 2,
      pageSize: 10,
      sortBy: "stressLevel",
      sortOrder: "asc",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/wellness/history?userId=5&department=2&from=2026-08-01&to=2026-08-11&mood=GOOD&page=2&pageSize=10&sortBy=stressLevel&sortOrder=asc",
      undefined
    );
  });

  test("fetchEmployeeProfile omits query params when no range given", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: {} }));

    await fetchEmployeeProfile(7);

    expect(global.fetch).toHaveBeenCalledWith("/api/wellness/employees/7/profile", undefined);
  });

  test("fetchEmployeeProfile includes from/to when given", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: {} }));

    await fetchEmployeeProfile(7, { from: "2026-07-01", to: "2026-08-01" });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/wellness/employees/7/profile?from=2026-07-01&to=2026-08-01",
      undefined
    );
  });

  test("fetchEmployeeTrend defaults to stress/30d", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    await fetchEmployeeTrend(7);

    expect(global.fetch).toHaveBeenCalledWith("/api/wellness/employees/7/trend?metric=stress&range=30d", undefined);
  });

  test("returns a network-error shape when fetch throws", async () => {
    global.fetch.mockRejectedValue(new Error("network down"));

    const result = await fetchWellnessHistoryGrid();

    expect(result).toEqual({ ok: false, status: 0, data: { error: "Unable to reach the server. Please try again." } });
  });
});
