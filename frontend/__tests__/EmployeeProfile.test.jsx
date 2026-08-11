import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmployeeProfile from "../components/wellness/EmployeeProfile";

const PROFILE = {
  id: 7,
  name: "Bea Employee",
  departmentId: 3,
  range: { from: "2026-07-12", to: "2026-08-11" },
  stats: { avgStressLevel: 4.5, avgSleepHours: 7.2, avgEnergyScore: 3.5, entryCount: 10 },
};

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockFetchImplementation({ profileBody = PROFILE, trendBody = { data: [] } } = {}) {
  global.fetch = vi.fn((url) => {
    if (url.startsWith("/api/wellness/employees/7/profile")) return Promise.resolve(jsonResponse(200, profileBody));
    if (url.startsWith("/api/wellness/employees/7/trend")) return Promise.resolve(jsonResponse(200, trendBody));
    return Promise.resolve(jsonResponse(200, {}));
  });
}

describe("EmployeeProfile", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows a loading state, then the employee's info, stats, and trend chart", async () => {
    mockFetchImplementation();

    render(<EmployeeProfile employeeId={7} />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading employee profile/i);
    expect(await screen.findByRole("heading", { name: "Bea Employee" })).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("7.2")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Trend" })).toBeInTheDocument();
  });

  test("empty stats: shows a message when entryCount is 0 instead of null averages", async () => {
    mockFetchImplementation({
      profileBody: { ...PROFILE, stats: { avgStressLevel: null, avgSleepHours: null, avgEnergyScore: null, entryCount: 0 } },
    });

    render(<EmployeeProfile employeeId={7} />);

    expect(await screen.findByText(/no wellness entries in this range/i)).toBeInTheDocument();
  });

  test("error state: shows the backend's message (e.g. a 403 department-scope rejection) with Retry", async () => {
    let callCount = 0;
    global.fetch = vi.fn((url) => {
      if (url.startsWith("/api/wellness/employees/7/profile")) {
        callCount += 1;
        if (callCount === 1) return Promise.resolve(jsonResponse(403, { error: "Forbidden" }));
        return Promise.resolve(jsonResponse(200, PROFILE));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });

    render(<EmployeeProfile employeeId={7} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(callCount).toBe(2));
    expect(await screen.findByRole("heading", { name: "Bea Employee" })).toBeInTheDocument();
  });
});
