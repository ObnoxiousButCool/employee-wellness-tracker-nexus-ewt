"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchUsers, fetchDepartments, setUserStatus } from "../../lib/adminApi";
import { buildRoleOptions } from "../../lib/adminRoleCatalog";
import UserFormDialog from "./UserFormDialog";

const PAGE_SIZE = 20;

/**
 * Lists, searches, filters, paginates, creates, edits, and
 * activates/deactivates users against `GET/POST /api/admin/users`,
 * `PUT /api/admin/users/:id`, and `PATCH /api/admin/users/:id/status`.
 * Reads an initial `department` filter from the URL so
 * `DepartmentDeactivationDialog`'s "Manage affected users" link can deep-link
 * here pre-filtered.
 */
export default function UserManagement() {
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState(searchParams.get("department") || "");
  const [status, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState("");
  const [dialog, setDialog] = useState(null); // { mode: "create" } | { mode: "edit", user }

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    const [usersResult, departmentsResult] = await Promise.all([
      fetchUsers({ search, department, status, page, pageSize: PAGE_SIZE }),
      fetchDepartments(),
    ]);

    if (!usersResult.ok) {
      setLoadState("error");
      setErrorMessage(usersResult.data.error || "Unable to load users. Please try again.");
      return;
    }

    setUsers(usersResult.data.data || []);
    setPagination(usersResult.data.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
    if (departmentsResult.ok) setDepartments(departmentsResult.data.data || []);
    setLoadState("ready");
  }, [search, department, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const observedRoles = users
    .filter((u) => u.roleId != null)
    .map((u) => ({ roleId: u.roleId, role: u.role }));
  const roleOptions = buildRoleOptions(observedRoles);

  function handleFilterSubmit(event) {
    event.preventDefault();
    setPage(1);
    load();
  }

  async function handleToggleStatus(user) {
    const result = await setUserStatus(user.id, !user.isActive);
    if (!result.ok) {
      setErrorMessage(result.data.error || "Unable to update this user's status. Please try again.");
      return;
    }
    load();
  }

  return (
    <section aria-label="User management">
      <h2>Users</h2>

      <form onSubmit={handleFilterSubmit}>
        <label htmlFor="user-search">Search</label>
        <input
          id="user-search"
          type="search"
          placeholder="Name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <label htmlFor="user-department-filter">Department</label>
        <select id="user-department-filter" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <label htmlFor="user-status-filter">Status</label>
        <select id="user-status-filter" value={status} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button type="submit">Apply filters</button>
      </form>

      <button type="button" onClick={() => setDialog({ mode: "create" })}>
        Create User
      </button>

      {loadState === "loading" && <p role="status">Loading users…</p>}

      {loadState === "error" && (
        <div role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loadState === "ready" && users.length === 0 && <p>No users found.</p>}

      {loadState === "ready" && users.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.department || "—"}</td>
                  <td>{user.isActive ? "Active" : "Inactive"}</td>
                  <td>
                    <button type="button" onClick={() => setDialog({ mode: "edit", user })}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleToggleStatus(user)}>
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div aria-label="Pagination">
            <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {dialog && (
        <UserFormDialog
          mode={dialog.mode}
          user={dialog.user}
          departments={departments}
          roleOptions={roleOptions}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            load();
          }}
        />
      )}
    </section>
  );
}
