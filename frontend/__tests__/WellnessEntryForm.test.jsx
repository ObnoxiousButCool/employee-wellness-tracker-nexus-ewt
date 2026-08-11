import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WellnessEntryForm from "../components/wellness/WellnessEntryForm";

function fakeResponse({ ok, status, body }) {
  return { ok, status, json: async () => body };
}

function fillForm() {
  fireEvent.change(screen.getByLabelText(/stress level/i), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText(/work hours/i), { target: { value: "8" } });
  fireEvent.change(screen.getByLabelText(/sleep hours/i), { target: { value: "7" } });
  fireEvent.click(screen.getByLabelText("Good"));
  fireEvent.click(screen.getByLabelText("High"));
}

describe("WellnessEntryForm", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows a loading state while fetching today's entry", async () => {
    let resolveFetch;
    global.fetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<WellnessEntryForm />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading today's entry/i);

    resolveFetch(fakeResponse({ ok: true, status: 200, body: { data: [] } }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  test("empty state: renders a blank form when no entry exists for today", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    render(<WellnessEntryForm />);

    expect(await screen.findByText(/haven't submitted a wellness entry for today/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/stress level/i).value).toBe("");
  });

  test("error state on load failure shows a Retry button that reloads", async () => {
    global.fetch
      .mockResolvedValueOnce(fakeResponse({ ok: false, status: 500, body: { error: "boom" } }))
      .mockResolvedValueOnce(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    render(<WellnessEntryForm />);

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText(/log today's check-in/i)).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("prefills the form when an entry already exists for today", async () => {
    global.fetch.mockResolvedValue(
      fakeResponse({
        ok: true,
        status: 200,
        body: {
          data: [
            { id: 1, entryDate: "2026-08-11", stressLevel: 4, workHours: 6, sleepHours: 8, mood: "NEUTRAL", energyLevel: "MEDIUM" },
          ],
        },
      })
    );

    render(<WellnessEntryForm />);

    expect(await screen.findByText(/update today's check-in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/stress level/i).value).toBe("4");
    expect(screen.getByLabelText("Neutral")).toBeChecked();
    expect(screen.getByLabelText("Medium")).toBeChecked();
  });

  test("submits the form and shows a success message", async () => {
    global.fetch
      .mockResolvedValueOnce(fakeResponse({ ok: true, status: 200, body: { data: [] } }))
      .mockResolvedValueOnce(
        fakeResponse({
          ok: true,
          status: 200,
          body: { id: 9, stressLevel: 5, workHours: 8, sleepHours: 7, mood: "GOOD", energyLevel: "HIGH" },
        })
      );

    render(<WellnessEntryForm />);
    await screen.findByText(/haven't submitted/i);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /save check-in/i }));

    expect(await screen.findByTestId("submit-success")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/wellness/entries",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ stressLevel: 5, workHours: 8, sleepHours: 7, mood: "GOOD", energyLevel: "HIGH" }),
      })
    );
  });

  test("shows field-level errors from a 422 response without a generic banner", async () => {
    global.fetch
      .mockResolvedValueOnce(fakeResponse({ ok: true, status: 200, body: { data: [] } }))
      .mockResolvedValueOnce(
        fakeResponse({
          ok: false,
          status: 422,
          body: {
            errors: {
              stressLevel: "stressLevel must be an integer between 1 and 10",
              workHours: "workHours plus sleepHours must not exceed 24",
            },
          },
        })
      );

    render(<WellnessEntryForm />);
    await screen.findByText(/haven't submitted/i);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /save check-in/i }));

    expect(await screen.findByTestId("error-stressLevel")).toHaveTextContent(/between 1 and 10/);
    expect(screen.getByTestId("error-workHours")).toHaveTextContent(/must not exceed 24/);
    expect(screen.queryByTestId("submit-error")).not.toBeInTheDocument();
  });

  test("shows a generic error banner on a non-422 submit failure", async () => {
    global.fetch
      .mockResolvedValueOnce(fakeResponse({ ok: true, status: 200, body: { data: [] } }))
      .mockResolvedValueOnce(fakeResponse({ ok: false, status: 401, body: { error: "Unauthorized" } }));

    render(<WellnessEntryForm />);
    await screen.findByText(/haven't submitted/i);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /save check-in/i }));

    expect(await screen.findByTestId("submit-error")).toHaveTextContent("Unauthorized");
  });
});
