"use client";

import { useState } from "react";
import { createDepartment, updateDepartment } from "../../lib/adminApi";

/**
 * Create/rename form for a single department, shown as a modal dialog.
 * Surfaces the backend's exact error message inline (e.g. a 409 name
 * conflict) without closing the dialog.
 * @param {{mode: "create"|"edit", department?: object, onClose: () => void, onSaved: () => void}} props
 */
export default function DepartmentFormDialog({ mode, department, onClose, onSaved }) {
  const [name, setName] = useState(department?.name || "");
  const [status, setStatus] = useState("idle"); // idle | saving | error
  const [errorMessage, setErrorMessage] = useState("");

  const isEdit = mode === "edit";
  const title = isEdit ? `Rename department #${department.id}` : "Create department";

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const payload = { name: name.trim() };
    const result = isEdit ? await updateDepartment(department.id, payload) : await createDepartment(payload);

    if (!result.ok) {
      setStatus("error");
      setErrorMessage(result.data.error || "Unable to save this department. Please try again.");
      return;
    }

    onSaved();
  }

  return (
    <div role="dialog" aria-label={title}>
      <h2>{title}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="department-name">Name</label>
          <input id="department-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {status === "error" && (
          <p role="alert" data-testid="department-form-error">
            {errorMessage}
          </p>
        )}
        <button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onClose} disabled={status === "saving"}>
          Cancel
        </button>
      </form>
    </div>
  );
}
