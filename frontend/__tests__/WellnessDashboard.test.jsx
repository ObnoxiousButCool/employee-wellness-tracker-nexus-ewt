import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WellnessDashboard from "../components/wellness/WellnessDashboard";

const SCORES = {
  data: [
    { employeeId: 1, score: 96, classificationCategory: "Thriving" },
    { employeeId: 2, score: 8, classificationCategory: "Critical" },
  ],
};

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockFetchImplementation({ scoresBody = SCORES, departmentsBody = { data: [{ id: 1, name: "Engineering" }] } } = {}) {
  global.fetch = vi.fn((url) => {
    if (url.startsWith("/api/wellness/scores")) return Promise.resolve(jsonResponse(200, scoresBody));
    if (url.startsWith("/api/admin/departments")) return Promise.resolve(jsonResponse(200, departmentsBody));
    return Promise.resolve(jsonResponse(200, {}));
  });
}

describe("WellnessDashboard", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows a loading state, then a table of employee scores and classifications", async () => {
    mockFetchImplementation();

    render(<WellnessDashboard role="ADMIN" profileBasePath="/admin" />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading wellness scores/i);

    expect(await screen.findByText("#1")).toBeInTheDocument();
    expect(screen.getByText("96")).toBeInTheDocument();
    expect(screen.getByText("Thriving")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  test("empty state: shows a fallback message when there are no scores", async () => {
    mockFetchImplementation({ scoresBody: { data: [] } });

    render(<WellnessDashboard role="MANAGER" profileBasePath="/manager" />);

    expect(await screen.findByText(/no wellness scores found/i)).toBeInTheDocument();
  });

  test("error state: shows the backend's message with Retry, then recovers", async () => {
    let callCount = 0;
    global.fetch = vi.fn((url) => {
      if (url.startsWith("/api/wellness/scores")) {
        callCount += 1;
        if (callCount === 1) return Promise.resolve(jsonResponse(403, { error: "Forbidden" }));
        return Promise.resolve(jsonResponse(200, SCORES));
      }
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });

    render(<WellnessDashboard role="MANAGER" profileBasePath="/manager" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText("#1")).toBeInTheDocument());
  });

  test("department filter is ADMIN-only and re-fetches on change", async () => {
    mockFetchImplementation();

    render(<WellnessDashboard role="ADMIN" profileBasePath="/admin" />);

    await screen.findByText("#1");
    expect(global.fetch).toHaveBeenCalledWith("/api/wellness/scores", undefined);

    fireEvent.change(await screen.findByLabelText(/department/i), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /apply filter/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/wellness/scores?department=1", undefined)
    );
  });

  test("MANAGER role never renders the department filter", async () => {
    mockFetchImplementation();

    render(<WellnessDashboard role="MANAGER" profileBasePath="/manager" />);

    await screen.findByText("#1");
    expect(screen.queryByLabelText(/department/i)).not.toBeInTheDocument();
  });
});
