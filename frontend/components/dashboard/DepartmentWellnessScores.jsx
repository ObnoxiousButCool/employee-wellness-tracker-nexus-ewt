/** Renders one row per department in scope (S5 API Contract). */
export default function DepartmentWellnessScores({ rows }) {
  return (
    <section aria-label="Department wellness scores">
      <h3>Department wellness scores</h3>
      {rows.length === 0 ? (
        <p>No departments in scope.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Department</th>
              <th>Score</th>
              <th>Employees</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.departmentId}>
                <td>{row.name}</td>
                <td>{row.score === null ? "—" : row.score}</td>
                <td>{row.employeeCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
