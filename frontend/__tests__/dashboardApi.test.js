import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fetchDashboardSummary } from "../lib/dashboardApi";

function fakeResponse({ ok, status, body }) {
  return { ok, status, json: async () => body };
}

describe("dashboardApi client wrapper", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("defaults to scope=org with no departmentId", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: {} }));

    await fetchDashboardSummary();

    expect(global.fetch).toHaveBeenCalledWith("/api/dashboard/summary?scope=org", undefined);
  });

  test("includes departmentId when scope=department", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: {} }));

    await fetchDashboardSummary({ scope: "department", departmentId: "3" });

    expect(global.fetch).toHaveBeenCalledWith("/api/dashboard/summary?scope=department&departmentId=3", undefined);
  });

  test("returns a network-error shape when fetch throws", async () => {
    global.fetch.mockRejectedValue(new Error("network down"));

    const result = await fetchDashboardSummary();

    expect(result).toEqual({ ok: false, status: 0, data: { error: "Unable to reach the server. Please try again." } });
  });

  test("passes through the backend's status and body on a non-2xx response", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: false, status: 404, body: { error: "Department not found" } }));

    const result = await fetchDashboardSummary({ scope: "department", departmentId: "999" });

    expect(result).toEqual({ ok: false, status: 404, data: { error: "Department not found" } });
  });
});
