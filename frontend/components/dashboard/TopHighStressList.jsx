/** Renders the top-5 high-stress employee ranking (S5 API Contract). */
export default function TopHighStressList({ employees }) {
  return (
    <section aria-label="Top 5 high stress employees">
      <h3>Top 5 high-stress employees</h3>
      {employees.length === 0 ? (
        <p>No employees with entries in the last 7 days.</p>
      ) : (
        <ol>
          {employees.map((employee) => (
            <li key={employee.employeeId}>
              {employee.name ?? `Employee #${employee.employeeId}`} — stress {employee.stressLevel}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
