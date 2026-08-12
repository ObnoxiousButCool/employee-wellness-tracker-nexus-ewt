import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import DashboardSummary from "../components/dashboard/DashboardSummary";
import { notifyWellnessEntrySubmitted } from "../lib/wellnessEvents";

const SUMMARY = {
  scope: "org",
  departmentId: null,
  kpiCards: [
    { name: "Total Active Employees", value: 12, description: "Active employees within the selected scope" },
    { name: "Submissions Today", value: 3, description: "Wellness check-ins submitted today within the selected scope" },
    { name: "Average Wellness Score", value: 68.5, description: "Average wellness score over the trailing 7 days within the selected scope" },
    { name: "Employees Requiring Attention", value: 2, description: "Employees whose trailing 7-day average stress level meets or exceeds the attention threshold" },
  ],
  wellnessStatusDistribution: [
    { category: "THRIVING", count: 3 },
    { category: "STABLE", count: 5 },
    { category: "AT_RISK", count: 2 },
    { category: "CRITICAL", count: 1 },
  ],
  departmentWellnessScores: [{ departmentId: 1, name: "Engineering", score: 72.1, employeeCount: 6 }],
  weeklyWellnessTrends: [
    { date: "2026-08-05", score: 60 },
    { date: "2026-08-06", score: 65 },
    { date: "2026-08-07", score: null },
    { date: "2026-08-08", score: 70 },
    { date: "2026-08-09", score: 68 },
    { date: "2026-08-10", score: 71 },
    { date: "2026-08-11", score: 69 },
  ],
  topHighStressEmployees: [{ employeeId: 9, name: "Sam Stressed", stressLevel: 8.4 }],
};

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockFetchImplementation({ summaryBody = SUMMARY, departmentsBody = { data: [{ id: 1, name: "Engineering" }] } } = {}) {
  global.fetch = vi.fn((url) => {
    if (url.startsWith("/api/dashboard/summary")) return Promise.resolve(jsonResponse(200, summaryBody));
    if (url.startsWith("/api/admin/departments")) return Promise.resolve(jsonResponse(200, departmentsBody));
    return Promise.resolve(jsonResponse(200, {}));
  });
}

describe("DashboardSummary", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows a loading state, then KPI cards, distribution, department scores, trend, and top-5 stress list", async () => {
    mockFetchImplementation();

    render(<DashboardSummary role="ADMIN" />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading dashboard/i);

    expect(await screen.findByTestId("kpi-Total Active Employees")).toHaveTextContent("12");
    expect(screen.getByTestId("kpi-Submissions Today")).toHaveTextContent("3");
    expect(screen.getByTestId("kpi-Average Wellness Score")).toHaveTextContent("68.5");
    expect(screen.getByTestId("kpi-Employees Requiring Attention")).toHaveTextContent("2");

    expect(screen.getByText("THRIVING: 3")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("72.1")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /weekly wellness trend/i })).toBeInTheDocument();
    expect(screen.getByText(/Sam Stressed/)).toBeInTheDocument();
  });

  test("empty state: shows fallback messages when every section is empty", async () => {
    mockFetchImplementation({
      summaryBody: {
        ...SUMMARY,
        wellnessStatusDistribution: SUMMARY.wellnessStatusDistribution.map((row) => ({ ...row, count: 0 })),
        departmentWellnessScores: [],
        weeklyWellnessTrends: SUMMARY.weeklyWellnessTrends.map((point) => ({ ...point, score: null })),
        topHighStressEmployees: [],
      },
    });

    render(<DashboardSummary role="MANAGER" />);

    expect(await screen.findByText(/no employees have submitted a wellness entry/i)).toBeInTheDocument();
    expect(screen.getByText(/no departments in scope/i)).toBeInTheDocument();
    expect(screen.getByText(/no wellness entries in the last 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/no employees with entries in the last 7 days/i)).toBeInTheDocument();
  });

  test("error state: shows the backend's message with Retry, and Retry recovers", async () => {
    let callCount = 0;
    global.fetch = vi.fn((url) => {
      if (url.startsWith("/api/dashboard/summary")) {
        callCount += 1;
        if (callCount === 1) return Promise.resolve(jsonResponse(403, { error: "Forbidden" }));
        return Promise.resolve(jsonResponse(200, SUMMARY));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });

    render(<DashboardSummary role="MANAGER" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
    screen.getByRole("button", { name: /retry/i }).click();

    expect(await screen.findByTestId("kpi-Total Active Employees")).toHaveTextContent("12");
  });

  test("ADMIN sees the department filter, MANAGER does not", async () => {
    mockFetchImplementation();
    render(<DashboardSummary role="ADMIN" />);
    expect(await screen.findByLabelText("Scope")).toBeInTheDocument();

    cleanup();
    vi.restoreAllMocks();
    mockFetchImplementation();
    render(<DashboardSummary role="MANAGER" />);
    await screen.findByTestId("kpi-Total Active Employees");
    expect(screen.queryByLabelText("Scope")).not.toBeInTheDocument();
  });

  test("refetches after a wellness-entry-submitted notification", async () => {
    mockFetchImplementation();
    render(<DashboardSummary role="MANAGER" />);
    await screen.findByTestId("kpi-Total Active Employees");

    const summaryCallsBefore = global.fetch.mock.calls.filter((c) => c[0].startsWith("/api/dashboard/summary")).length;

    notifyWellnessEntrySubmitted();

    await waitFor(() => {
      const summaryCallsAfter = global.fetch.mock.calls.filter((c) => c[0].startsWith("/api/dashboard/summary")).length;
      expect(summaryCallsAfter).toBe(summaryCallsBefore + 1);
    });
  });
});
