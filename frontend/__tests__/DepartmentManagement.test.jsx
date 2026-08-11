import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import DepartmentManagement from "../components/admin/DepartmentManagement";

const ENGINEERING = { id: 3, name: "Engineering", isActive: true, activeUserCount: 2 };
const EMPTY_DEPT = { id: 4, name: "Facilities", isActive: true, activeUserCount: 0 };

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("DepartmentManagement", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows a loading state, then the fetched departments", async () => {
    global.fetch = vi.fn(() => Promise.resolve(jsonResponse(200, { data: [ENGINEERING] })));

    render(<DepartmentManagement />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading departments/i);
    expect(await screen.findByRole("cell", { name: "Engineering" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2" })).toBeInTheDocument();
  });

  test("shows an empty state when there are no departments", async () => {
    global.fetch = vi.fn(() => Promise.resolve(jsonResponse(200, { data: [] })));

    render(<DepartmentManagement />);

    expect(await screen.findByText(/no departments found/i)).toBeInTheDocument();
  });

  test("shows an error state with Retry on a failed fetch, and Retry re-fetches", async () => {
    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) return Promise.resolve(jsonResponse(500, { error: "Internal error" }));
      return Promise.resolve(jsonResponse(200, { data: [ENGINEERING] }));
    });

    render(<DepartmentManagement />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Internal error");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByRole("cell", { name: "Engineering" })).toBeInTheDocument();
  });

  test("creating a department posts the form and refreshes the list", async () => {
    let created = false;
    global.fetch = vi.fn((url, options) => {
      if (url === "/api/admin/departments" && options?.method === "POST") {
        created = true;
        return Promise.resolve(jsonResponse(201, { id: 5, name: "HR", isActive: true, activeUserCount: 0 }));
      }
      const data = created ? [ENGINEERING, { id: 5, name: "HR", isActive: true, activeUserCount: 0 }] : [ENGINEERING];
      return Promise.resolve(jsonResponse(200, { data }));
    });

    render(<DepartmentManagement />);
    await screen.findByRole("cell", { name: "Engineering" });

    fireEvent.click(screen.getByRole("button", { name: /create department/i }));
    const dialog = screen.getByRole("dialog", { name: /create department/i });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "HR" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByRole("cell", { name: "HR" })).toBeInTheDocument();
  });

  test("creating a department with a duplicate name shows the backend's 409 message inline", async () => {
    global.fetch = vi.fn((url, options) => {
      if (url === "/api/admin/departments" && options?.method === "POST") {
        return Promise.resolve(jsonResponse(409, { error: "Department name is already in use" }));
      }
      return Promise.resolve(jsonResponse(200, { data: [ENGINEERING] }));
    });

    render(<DepartmentManagement />);
    await screen.findByRole("cell", { name: "Engineering" });

    fireEvent.click(screen.getByRole("button", { name: /create department/i }));
    const dialog = screen.getByRole("dialog", { name: /create department/i });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Engineering" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));

    expect(await screen.findByTestId("department-form-error")).toHaveTextContent("Department name is already in use");
  });

  test("deactivating a department with active users opens a warning dialog instead of applying immediately", async () => {
    global.fetch = vi.fn(() => Promise.resolve(jsonResponse(200, { data: [ENGINEERING] })));

    render(<DepartmentManagement />);
    await screen.findByRole("cell", { name: "Engineering" });

    fireEvent.click(screen.getByRole("button", { name: /^deactivate$/i }));

    const warning = await screen.findByRole("alert", { name: /deactivate engineering/i });
    expect(within(warning).getByText(/2 active users/i)).toBeInTheDocument();
    expect(within(warning).getByRole("link", { name: /manage affected users/i })).toHaveAttribute(
      "href",
      "/admin/users?department=3"
    );

    // No PUT should have gone out yet: only the initial GET calls have fired.
    expect(global.fetch).not.toHaveBeenCalledWith("/api/admin/departments/3", expect.objectContaining({ method: "PUT" }));
  });

  test("Deactivate anyway calls PUT with isActive:false and closes the warning", async () => {
    let deactivated = false;
    global.fetch = vi.fn((url, options) => {
      if (url === "/api/admin/departments/3" && options?.method === "PUT") {
        deactivated = true;
        return Promise.resolve(jsonResponse(200, { ...ENGINEERING, isActive: false }));
      }
      return Promise.resolve(
        jsonResponse(200, { data: [{ ...ENGINEERING, isActive: !deactivated }] })
      );
    });

    render(<DepartmentManagement />);
    await screen.findByRole("cell", { name: "Engineering" });

    fireEvent.click(screen.getByRole("button", { name: /^deactivate$/i }));
    const warning = await screen.findByRole("alert", { name: /deactivate engineering/i });
    fireEvent.click(within(warning).getByRole("button", { name: /deactivate anyway/i }));

    await waitFor(() => expect(screen.queryByRole("alert", { name: /deactivate engineering/i })).not.toBeInTheDocument());
    expect(await screen.findByRole("cell", { name: "Inactive" })).toBeInTheDocument();
  });

  test("deactivating a department with zero active users applies immediately without a warning", async () => {
    global.fetch = vi.fn((url, options) => {
      if (url === "/api/admin/departments/4" && options?.method === "PUT") {
        return Promise.resolve(jsonResponse(200, { ...EMPTY_DEPT, isActive: false }));
      }
      return Promise.resolve(jsonResponse(200, { data: [EMPTY_DEPT] }));
    });

    render(<DepartmentManagement />);
    await screen.findByRole("cell", { name: "Facilities" });

    fireEvent.click(screen.getByRole("button", { name: /^deactivate$/i }));

    expect(screen.queryByRole("alert", { name: /deactivate facilities/i })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/departments/4",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ isActive: false }) })
      )
    );
  });
});
