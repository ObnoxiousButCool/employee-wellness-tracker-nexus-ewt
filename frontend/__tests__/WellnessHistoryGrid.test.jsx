import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WellnessHistoryGrid from "../components/wellness/WellnessHistoryGrid";

const ROW = {
  id: 1,
  userId: 7,
  employeeName: "Ann Admin",
  departmentId: 3,
  entryDate: "2026-08-11",
  mood: "GOOD",
  stressLevel: 4,
  sleepHours: 7,
  energyScore: 4,
};

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockFetchImplementation({ historyBody = { data: [ROW], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } } = {}) {
  global.fetch = vi.fn((url) => {
    if (url.startsWith("/api/wellness/history")) return Promise.resolve(jsonResponse(200, historyBody));
    if (url.startsWith("/api/admin/departments")) {
      return Promise.resolve(jsonResponse(200, { data: [{ id: 3, name: "Engineering", isActive: true, activeUserCount: 1 }] }));
    }
    return Promise.resolve(jsonResponse(200, {}));
  });
}

describe("WellnessHistoryGrid", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows a loading state, then the fetched rows", async () => {
    mockFetchImplementation();

    render(<WellnessHistoryGrid role="MANAGER" profileBasePath="/manager" />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading wellness history/i);
    expect(await screen.findByText("Ann Admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ann Admin" })).toHaveAttribute("href", "/manager/employees/7");
  });

  test("empty state: shows a message when there are no rows", async () => {
    mockFetchImplementation({ historyBody: { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } });

    render(<WellnessHistoryGrid role="MANAGER" profileBasePath="/manager" />);

    expect(await screen.findByText(/no wellness entries found/i)).toBeInTheDocument();
  });

  test("error state: shows the backend's message with a Retry button that reloads", async () => {
    let callCount = 0;
    global.fetch = vi.fn((url) => {
      if (url.startsWith("/api/wellness/history")) {
        callCount += 1;
        if (callCount === 1) return Promise.resolve(jsonResponse(500, { error: "history unavailable" }));
        return Promise.resolve(jsonResponse(200, { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }));
      }
      return Promise.resolve(jsonResponse(200, {}));
    });

    render(<WellnessHistoryGrid role="MANAGER" profileBasePath="/manager" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("history unavailable");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText(/no wellness entries found/i)).toBeInTheDocument());
    expect(callCount).toBe(2);
  });

  test("does not show a department filter for a MANAGER", async () => {
    mockFetchImplementation();

    render(<WellnessHistoryGrid role="MANAGER" profileBasePath="/manager" />);
    await screen.findByText("Ann Admin");

    expect(screen.queryByLabelText(/department/i)).not.toBeInTheDocument();
  });

  test("shows a department filter for an ADMIN, populated from /api/admin/departments", async () => {
    mockFetchImplementation();

    render(<WellnessHistoryGrid role="ADMIN" profileBasePath="/admin" />);
    await screen.findByText("Ann Admin");

    expect(await screen.findByRole("option", { name: "Engineering" })).toBeInTheDocument();
  });

  test("clicking a sortable column header re-fetches with the new sortBy/sortOrder", async () => {
    mockFetchImplementation();

    render(<WellnessHistoryGrid role="MANAGER" profileBasePath="/manager" />);
    await screen.findByText("Ann Admin");

    fireEvent.click(screen.getByRole("button", { name: /^stress/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("sortBy=stressLevel"),
        undefined
      )
    );
  });
});
