import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TrendChart from "../components/wellness/TrendChart";

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("TrendChart", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows a loading state, then renders the chart and data table for the fetched series", async () => {
    let resolveFetch;
    global.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    render(<TrendChart employeeId={7} />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading trend/i);

    resolveFetch(
      jsonResponse(200, {
        data: [
          { date: "2026-07-12", value: 5 },
          { date: "2026-07-13", value: 6 },
        ],
      })
    );

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.getByRole("img", { name: /stress trend over 30d/i })).toBeInTheDocument();
    expect(screen.getByText("2026-07-12")).toBeInTheDocument();
  });

  test("empty state: shows a message when there are no points in range", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { data: [] }));

    render(<TrendChart employeeId={7} />);

    expect(await screen.findByText(/no wellness entries in this range/i)).toBeInTheDocument();
  });

  test("error state: shows the backend's message with a Retry button that reloads", async () => {
    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) return Promise.resolve(jsonResponse(500, { error: "trend unavailable" }));
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });

    render(<TrendChart employeeId={7} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("trend unavailable");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText(/no wellness entries in this range/i)).toBeInTheDocument());
    expect(callCount).toBe(2);
  });

  test("changing the metric selector re-fetches with the new metric", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ date: "2026-07-12", value: 5 }] }));

    render(<TrendChart employeeId={7} />);
    await screen.findByText("2026-07-12");

    fireEvent.change(screen.getByLabelText("Metric"), { target: { value: "sleep" } });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenLastCalledWith(
        "/api/wellness/employees/7/trend?metric=sleep&range=30d",
        undefined
      )
    );
  });
});
