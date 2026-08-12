const CHART_WIDTH = 480;
const CHART_HEIGHT = 160;

function buildPolylinePoints(points) {
  const known = points.filter((p) => p.score !== null);
  if (known.length === 0) return "";
  const values = known.map((p) => p.score);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = points.length > 1 ? CHART_WIDTH / (points.length - 1) : 0;

  return points
    .filter((p) => p.score !== null)
    .map((p) => {
      const i = points.indexOf(p);
      const x = points.length > 1 ? i * stepX : CHART_WIDTH / 2;
      const y = CHART_HEIGHT - ((p.score - min) / span) * CHART_HEIGHT;
      return `${x},${y}`;
    })
    .join(" ");
}

/** Renders the last 7 days of org/department average wellness score (S5 API Contract). */
export default function WeeklyTrendChart({ points }) {
  return (
    <section aria-label="Weekly wellness trend">
      <h3>Weekly wellness trend</h3>
      {points.every((point) => point.score === null) ? (
        <p>No wellness entries in the last 7 days.</p>
      ) : (
        <>
          <svg
            role="img"
            aria-label="Weekly wellness trend"
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          >
            <polyline points={buildPolylinePoints(points)} fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{point.score === null ? "—" : point.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
