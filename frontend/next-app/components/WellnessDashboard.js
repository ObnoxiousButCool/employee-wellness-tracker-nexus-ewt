/**
 * Render a wellness operations dashboard overview.
 */
export default function WellnessDashboard() {
  const metrics = [
    { label: "Average stress", value: "3.2", trend: "Down 8%" },
    { label: "Average sleep", value: "7.1h", trend: "Up 4%" },
    { label: "Energy score", value: "82", trend: "Stable" },
  ];

  return (
    <main className="dashboard-shell">
      <section className="hero-band">
        <div>
          <p className="eyebrow">Employee Wellness Tracker Nexus</p>
          <h1>Wellness signals for healthier teams</h1>
          <p className="intro">
            Track daily stress, sleep, energy, and mood patterns while giving
            managers a clear view of team health trends.
          </p>
        </div>
      </section>

      <section className="metric-grid" aria-label="Wellness summary metrics">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.trend}</small>
          </article>
        ))}
      </section>

      <section className="work-panel">
        <div>
          <h2>Daily wellness entry</h2>
          <div className="entry-grid">
            <label>
              Stress level
              <input type="number" min="1" max="10" defaultValue="4" />
            </label>
            <label>
              Work hours
              <input type="number" min="0" max="24" defaultValue="8" />
            </label>
            <label>
              Sleep hours
              <input type="number" min="0" max="24" defaultValue="7" />
            </label>
            <label>
              Mood
              <select defaultValue="focused">
                <option value="focused">Focused</option>
                <option value="calm">Calm</option>
                <option value="stretched">Stretched</option>
              </select>
            </label>
          </div>
          <button type="button">Save entry</button>
        </div>
      </section>
    </main>
  );
}

