import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WellnessHistory from "../components/wellness/WellnessHistory";

function fakeResponse({ ok, status, body }) {
  return { ok, status, json: async () => body };
}

describe("WellnessHistory", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows a loading state, then the fetched entries newest-first as returned by the backend", async () => {
    let resolveFetch;
    global.fetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<WellnessHistory />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading your wellness history/i);

    resolveFetch(
      fakeResponse({
        ok: true,
        status: 200,
        body: {
          data: [
            { id: 2, entryDate: "2026-08-11", stressLevel: 3, workHours: 7, sleepHours: 8, mood: "GOOD", energyLevel: "HIGH" },
            { id: 1, entryDate: "2026-08-10", stressLevel: 6, workHours: 9, sleepHours: 6, mood: "LOW", energyLevel: "LOW" },
          ],
        },
      })
    );

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("2026-08-11");
    expect(rows[2]).toHaveTextContent("2026-08-10");
  });

  test("empty state: shows a message when there are no entries", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    render(<WellnessHistory />);

    expect(await screen.findByText(/no wellness entries yet/i)).toBeInTheDocument();
  });

  test("error state: shows the backend's message with a Retry button that reloads", async () => {
    global.fetch
      .mockResolvedValueOnce(fakeResponse({ ok: false, status: 500, body: { error: "history unavailable" } }))
      .mockResolvedValueOnce(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    render(<WellnessHistory />);

    expect(await screen.findByRole("alert")).toHaveTextContent("history unavailable");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText(/no wellness entries yet/i)).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
