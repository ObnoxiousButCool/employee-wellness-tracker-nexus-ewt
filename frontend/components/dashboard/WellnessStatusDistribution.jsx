/** Renders the S6-provisional wellness status distribution buckets (S5 API Contract). */
export default function WellnessStatusDistribution({ rows }) {
  return (
    <section aria-label="Wellness status distribution">
      <h3>Wellness status distribution</h3>
      {rows.every((row) => row.count === 0) ? (
        <p>No employees have submitted a wellness entry in the last 7 days.</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.category}>
              {row.category}: {row.count}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
