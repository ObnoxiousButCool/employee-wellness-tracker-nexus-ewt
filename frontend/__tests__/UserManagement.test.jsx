import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import UserManagement from "../components/admin/UserManagement";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const USER = {
  id: 1,
  name: "Ann Admin",
  email: "ann@ewt.test",
  roleId: 1,
  role: "ADMIN",
  departmentId: 3,
  department: "Engineering",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const DEPARTMENTS_RESPONSE = { data: [{ id: 3, name: "Engineering", isActive: true, activeUserCount: 1 }] };

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockFetchImplementation({ usersBody = { data: [USER], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } } = {}) {
  global.fetch = vi.fn((url, options) => {
    if (url.startsWith("/api/admin/users") && (!options || options.method === undefined)) {
      return Promise.resolve(jsonResponse(200, usersBody));
    }
    if (url.startsWith("/api/admin/departments") && (!options || options.method === undefined)) {
      return Promise.resolve(jsonResponse(200, DEPARTMENTS_RESPONSE));
    }
    return Promise.resolve(jsonResponse(200, {}));
  });
}

describe("UserManagement", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows a loading state, then the fetched users", async () => {
    mockFetchImplementation();

    render(<UserManagement />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading users/i);
    expect(await screen.findByText("Ann Admin")).toBeInTheDocument();
    expect(screen.getByText("ann@ewt.test")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Engineering" })).toBeInTheDocument();
  });

  test("shows an empty state when there are no users", async () => {
    mockFetchImplementation({ usersBody: { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } });

    render(<UserManagement />);

    expect(await screen.findByText(/no users found/i)).toBeInTheDocument();
  });

  test("shows an error state with Retry on a failed fetch, and Retry re-fetches", async () => {
    let callCount = 0;
    global.fetch = vi.fn((url) => {
      if (url.startsWith("/api/admin/users")) {
        callCount += 1;
        if (callCount === 1) return Promise.resolve(jsonResponse(500, { error: "Internal error" }));
        return Promise.resolve(
          jsonResponse(200, { data: [USER], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } })
        );
      }
      return Promise.resolve(jsonResponse(200, DEPARTMENTS_RESPONSE));
    });

    render(<UserManagement />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Internal error");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Ann Admin")).toBeInTheDocument();
  });

  test("creating a user posts the form and refreshes the list on success", async () => {
    let createCalled = false;
    global.fetch = vi.fn((url, options) => {
      if (url === "/api/admin/users" && options?.method === "POST") {
        createCalled = true;
        return Promise.resolve(jsonResponse(201, { ...USER, id: 2, name: "Bea Employee" }));
      }
      if (url.startsWith("/api/admin/users")) {
        const users = createCalled ? [USER, { ...USER, id: 2, name: "Bea Employee" }] : [USER];
        return Promise.resolve(
          jsonResponse(200, { data: users, pagination: { page: 1, pageSize: 20, total: users.length, totalPages: 1 } })
        );
      }
      return Promise.resolve(jsonResponse(200, DEPARTMENTS_RESPONSE));
    });

    render(<UserManagement />);
    await screen.findByText("Ann Admin");

    fireEvent.click(screen.getByRole("button", { name: /create user/i }));
    const dialog = screen.getByRole("dialog", { name: /create user/i });

    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Bea Employee" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "bea@ewt.test" } });
    fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "password1" } });
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Bea Employee")).toBeInTheDocument();
  });

  test("creating a user with a duplicate email shows the backend's 409 message inline and keeps the dialog open", async () => {
    global.fetch = vi.fn((url, options) => {
      if (url === "/api/admin/users" && options?.method === "POST") {
        return Promise.resolve(jsonResponse(409, { error: "Email is already in use" }));
      }
      if (url.startsWith("/api/admin/users")) {
        return Promise.resolve(
          jsonResponse(200, { data: [USER], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } })
        );
      }
      return Promise.resolve(jsonResponse(200, DEPARTMENTS_RESPONSE));
    });

    render(<UserManagement />);
    await screen.findByText("Ann Admin");

    fireEvent.click(screen.getByRole("button", { name: /create user/i }));
    const dialog = screen.getByRole("dialog", { name: /create user/i });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Dup" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "ann@ewt.test" } });
    fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "password1" } });
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));

    expect(await screen.findByTestId("user-form-error")).toHaveTextContent("Email is already in use");
    expect(screen.getByRole("dialog", { name: /create user/i })).toBeInTheDocument();
  });

  test("role picker offers every documented role even when no loaded user has it yet", async () => {
    mockFetchImplementation(); // only an ADMIN user is loaded

    render(<UserManagement />);
    await screen.findByText("Ann Admin");

    fireEvent.click(screen.getByRole("button", { name: /create user/i }));
    const dialog = screen.getByRole("dialog", { name: /create user/i });
    const roleSelect = within(dialog).getByLabelText("Role");

    expect(within(roleSelect).getByRole("option", { name: "ADMIN" })).toBeInTheDocument();
    expect(within(roleSelect).getByRole("option", { name: "MANAGER" })).toBeInTheDocument();
    expect(within(roleSelect).getByRole("option", { name: "EMPLOYEE" })).toBeInTheDocument();
  });

  test("toggling status calls PATCH .../status and refreshes the row", async () => {
    let isActive = true;
    global.fetch = vi.fn((url, options) => {
      if (url === "/api/admin/users/1/status" && options?.method === "PATCH") {
        isActive = JSON.parse(options.body).isActive;
        return Promise.resolve(jsonResponse(200, { ...USER, isActive }));
      }
      if (url.startsWith("/api/admin/users")) {
        return Promise.resolve(
          jsonResponse(200, {
            data: [{ ...USER, isActive }],
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          })
        );
      }
      return Promise.resolve(jsonResponse(200, DEPARTMENTS_RESPONSE));
    });

    render(<UserManagement />);
    await screen.findByText("Ann Admin");

    fireEvent.click(screen.getByRole("button", { name: /^deactivate$/i }));

    expect(await screen.findByRole("button", { name: /^activate$/i })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Inactive" })).toBeInTheDocument();
  });
});
