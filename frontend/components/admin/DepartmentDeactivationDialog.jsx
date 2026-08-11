"use client";

import Link from "next/link";
import { useState } from "react";
import { updateDepartment } from "../../lib/adminApi";

/**
 * Warns the admin before deactivating a department that still has active
 * users assigned to it. The backend's `PUT /api/admin/departments/:id`
 * never cascades to `users` (see API Contract), so deactivating leaves
 * those users' `isActive`/`departmentId` untouched — this dialog exists so
 * the admin makes that call explicitly instead of it happening silently.
 * @param {{department: object, onClose: () => void, onDeactivated: () => void}} props
 */
export default function DepartmentDeactivationDialog({ department, onClose, onDeactivated }) {
  const [status, setStatus] = useState("idle"); // idle | saving | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handleDeactivateAnyway() {
    setStatus("saving");
    setErrorMessage("");

    const result = await updateDepartment(department.id, { isActive: false });

    if (!result.ok) {
      setStatus("error");
      setErrorMessage(result.data.error || "Unable to deactivate this department. Please try again.");
      return;
    }

    onDeactivated();
  }

  return (
    <div role="alert" aria-label={`Deactivate ${department.name}`}>
      <h2>Deactivate {department.name}?</h2>
      <p>
        {department.activeUserCount} active user{department.activeUserCount === 1 ? "" : "s"} are still assigned to
        this department. Deactivating it will not change those users&apos; status or reassign them — you should
        reassign or deactivate them first.
      </p>
      {status === "error" && <p role="alert">{errorMessage}</p>}
      <Link href={`/admin/users?department=${department.id}`}>Manage affected users</Link>
      <button type="button" onClick={handleDeactivateAnyway} disabled={status === "saving"}>
        {status === "saving" ? "Deactivating..." : "Deactivate anyway"}
      </button>
      <button type="button" onClick={onClose} disabled={status === "saving"}>
        Cancel
      </button>
    </div>
  );
}
