import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginForm from "../components/LoginForm";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function fillAndSubmit(email, password) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows a loading state while the request is in flight", async () => {
    let resolveFetch;
    global.fetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<LoginForm />);
    fillAndSubmit("admin@ewt.test", "correct-password");

    expect(await screen.findByRole("button", { name: /signing in/i })).toBeDisabled();

    resolveFetch({ ok: true, json: async () => ({ userId: 1, role: "ADMIN", departmentId: 3 }) });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/dashboard"));
  });

  test("redirects to the role landing page on success", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 7, role: "MANAGER", departmentId: 1 }),
    });

    render(<LoginForm />);
    fillAndSubmit("manager@ewt.test", "correct-password");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/manager/dashboard"));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "manager@ewt.test", password: "correct-password" }),
      })
    );
  });

  test("shows the backend's error message on invalid credentials (401)", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Invalid credentials" }),
    });

    render(<LoginForm />);
    fillAndSubmit("nobody@ewt.test", "wrong-password");

    expect(await screen.findByTestId("login-error")).toHaveTextContent("Invalid credentials");
    expect(pushMock).not.toHaveBeenCalled();
  });

  test("shows the backend's error message for an inactive account (403)", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Account is inactive" }),
    });

    render(<LoginForm />);
    fillAndSubmit("inactive@ewt.test", "correct-password");

    expect(await screen.findByTestId("login-error")).toHaveTextContent("Account is inactive");
  });

  test("shows a generic error when the network request itself fails", async () => {
    global.fetch.mockRejectedValue(new Error("network down"));

    render(<LoginForm />);
    fillAndSubmit("admin@ewt.test", "correct-password");

    expect(await screen.findByTestId("login-error")).toHaveTextContent(/unable to reach the server/i);
  });
});
