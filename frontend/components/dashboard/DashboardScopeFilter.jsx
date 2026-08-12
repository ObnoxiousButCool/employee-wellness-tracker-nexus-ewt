/**
 * ADMIN-only scope/department selector for DashboardSummary. A MANAGER's
 * scope is always forced server-side (S5 API Contract), so this filter is
 * never rendered for that role.
 */
export default function DashboardScopeFilter({ scope, onScopeChange, departmentId, onDepartmentIdChange, departments }) {
  return (
    <form onSubmit={(e) => e.preventDefault()} aria-label="Dashboard scope filter">
      <label htmlFor="dashboard-scope">Scope</label>
      <select id="dashboard-scope" value={scope} onChange={(e) => onScopeChange(e.target.value)}>
        <option value="org">Organization-wide</option>
        <option value="department">Single department</option>
      </select>

      {scope === "department" && (
        <>
          <label htmlFor="dashboard-department">Department</label>
          <select
            id="dashboard-department"
            value={departmentId}
            onChange={(e) => onDepartmentIdChange(e.target.value)}
          >
            <option value="">Select a department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </>
      )}
    </form>
  );
}
