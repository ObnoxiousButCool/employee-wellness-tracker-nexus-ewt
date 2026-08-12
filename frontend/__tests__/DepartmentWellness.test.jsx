import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DepartmentWellness from "../components/wellness/DepartmentWellness";

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("DepartmentWellness", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows a loading state, then the department's score", async () => {
    global.fetch = vi.fn(() => Promise.resolve(jsonResponse(200, { departmentId: 3, score: 52 })));

    render(<DepartmentWellness departmentId={3} />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading department wellness score/i);
    expect(await screen.findByText("52")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/departments/3/wellness/score", undefined);
  });

  test("empty state: shows a message when score is null instead of 0", async () => {
    global.fetch = vi.fn(() => Promise.resolve(jsonResponse(200, { departmentId: 4, score: null })));

    render(<DepartmentWellness departmentId={4} />);

    expect(await screen.findByText(/no employees in this department have submitted/i)).toBeInTheDocument();
  });

  test("error state: shows the backend's message with Retry, then recovers", async () => {
    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) return Promise.resolve(jsonResponse(403, { error: "Forbidden" }));
      return Promise.resolve(jsonResponse(200, { departmentId: 9, score: 40 }));
    });

    render(<DepartmentWellness departmentId={9} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText("40")).toBeInTheDocument());
  });
});
