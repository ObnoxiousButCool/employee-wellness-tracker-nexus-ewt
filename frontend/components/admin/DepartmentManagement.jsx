"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchDepartments, updateDepartment } from "../../lib/adminApi";
import DepartmentFormDialog from "./DepartmentFormDialog";
import DepartmentDeactivationDialog from "./DepartmentDeactivationDialog";

/**
 * Lists, creates, renames, and deactivates departments against
 * `GET/POST /api/admin/departments` and `PUT /api/admin/departments/:id`.
 * Since that single PUT endpoint never cascades to `users`, deactivating a
 * department with `activeUserCount > 0` opens a warning dialog instead of
 * applying immediately.
 */
export default function DepartmentManagement() {
  const [departments, setDepartments] = useState([]);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState("");
  const [dialog, setDialog] = useState(null); // { type: "form", mode, department? } | { type: "deactivate", department }

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    const result = await fetchDepartments();

    if (!result.ok) {
      setLoadState("error");
      setErrorMessage(result.data.error || "Unable to load departments. Please try again.");
      return;
    }

    setDepartments(result.data.data || []);
    setLoadState("ready");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeactivateClick(department) {
    if (department.activeUserCount > 0) {
      setDialog({ type: "deactivate", department });
      return;
    }
    const result = await updateDepartment(department.id, { isActive: false });
    if (!result.ok) {
      setErrorMessage(result.data.error || "Unable to deactivate this department. Please try again.");
      return;
    }
    load();
  }

  async function handleActivateClick(department) {
    const result = await updateDepartment(department.id, { isActive: true });
    if (!result.ok) {
      setErrorMessage(result.data.error || "Unable to activate this department. Please try again.");
      return;
    }
    load();
  }

  return (
    <section aria-label="Department management">
      <h2>Departments</h2>

      <button type="button" onClick={() => setDialog({ type: "form", mode: "create" })}>
        Create Department
      </button>

      {loadState === "loading" && <p role="status">Loading departments…</p>}

      {loadState === "error" && (
        <div role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loadState === "ready" && departments.length === 0 && <p>No departments found.</p>}

      {loadState === "ready" && departments.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Active Users</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id}>
                <td>{department.name}</td>
                <td>{department.isActive ? "Active" : "Inactive"}</td>
                <td>{department.activeUserCount}</td>
                <td>
                  <button type="button" onClick={() => setDialog({ type: "form", mode: "edit", department })}>
                    Rename
                  </button>
                  {department.isActive ? (
                    <button type="button" onClick={() => handleDeactivateClick(department)}>
                      Deactivate
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleActivateClick(department)}>
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialog?.type === "form" && (
        <DepartmentFormDialog
          mode={dialog.mode}
          department={dialog.department}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            load();
          }}
        />
      )}

      {dialog?.type === "deactivate" && (
        <DepartmentDeactivationDialog
          department={dialog.department}
          onClose={() => setDialog(null)}
          onDeactivated={() => {
            setDialog(null);
            load();
          }}
        />
      )}
    </section>
  );
}
