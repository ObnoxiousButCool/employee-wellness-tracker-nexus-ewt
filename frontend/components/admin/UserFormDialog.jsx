"use client";

import { useState } from "react";
import { createUser, updateUser } from "../../lib/adminApi";

/**
 * Create/edit form for a single user, shown as a modal dialog. In "edit"
 * mode the password field is omitted (PUT /api/admin/users/:id has no
 * password field in the API Contract). Surfaces the backend's exact error
 * message inline (e.g. a 409 email conflict) without closing the dialog.
 * @param {{mode: "create"|"edit", user?: object, departments: object[], roleOptions: {roleId: number, role: string}[], onClose: () => void, onSaved: () => void}} props
 */
export default function UserFormDialog({ mode, user, departments, roleOptions, onClose, onSaved }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(user?.roleId ? String(user.roleId) : "");
  const [departmentId, setDepartmentId] = useState(user?.departmentId ? String(user.departmentId) : "");
  const [status, setStatus] = useState("idle"); // idle | saving | error
  const [errorMessage, setErrorMessage] = useState("");

  const isEdit = mode === "edit";
  const title = isEdit ? `Edit user #${user.id}` : "Create user";

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const payload = {
      name: name.trim(),
      email: email.trim(),
      roleId: roleId ? Number(roleId) : undefined,
      departmentId: departmentId ? Number(departmentId) : null,
    };
    if (!isEdit) payload.password = password;

    const result = isEdit ? await updateUser(user.id, payload) : await createUser(payload);

    if (!result.ok) {
      setStatus("error");
      setErrorMessage(result.data.error || "Unable to save this user. Please try again.");
      return;
    }

    onSaved();
  }

  return (
    <div role="dialog" aria-label={title}>
      <h2>{title}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="user-name">Name</label>
          <input id="user-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="user-email">Email</label>
          <input
            id="user-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {!isEdit && (
          <div>
            <label htmlFor="user-password">Password</label>
            <input
              id="user-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
        <div>
          <label htmlFor="user-role">Role</label>
          <select id="user-role" required value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">Select a role</option>
            {roleOptions.map((option) => (
              <option key={option.roleId} value={option.roleId}>
                {option.role}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="user-department">Department</label>
          <select id="user-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">No department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
        {status === "error" && (
          <p role="alert" data-testid="user-form-error">
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
