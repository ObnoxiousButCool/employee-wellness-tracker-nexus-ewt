import { useState } from "react";

/**
 * Render a wellness operations dashboard overview.
 */
export default function WellnessDashboard() {
  const [entry, setEntry] = useState({
    stress_level: "4",
    work_hours: "8",
    sleep_hours: "7",
    mood: "focused",
    energy_level: "7",
  });
  const [status, setStatus] = useState({ type: "idle", message: "" });

  const metrics = [
    { label: "Average stress", value: "3.2", trend: "Down 8%" },
    { label: "Average sleep", value: "7.1h", trend: "Up 4%" },
    { label: "Energy score", value: "82", trend: "Stable" },
  ];

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setEntry((currentEntry) => ({ ...currentEntry, [name]: value }));
  };

  const handleSaveEntry = async () => {
    setStatus({ type: "saving", message: "Saving entry..." });
    const accessToken =
      typeof window !== "undefined" ? window.localStorage.getItem("ewt_access_token") : "";
    try {
      const response = await fetch("/api/wellness/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          ...entry,
          date: new Date().toISOString().slice(0, 10),
          stress_level: Number(entry.stress_level),
          work_hours: Number(entry.work_hours),
          sleep_hours: Number(entry.sleep_hours),
          energy_level: Number(entry.energy_level),
        }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || "Unable to save entry");
      }
      // Defect 13: wire the Save entry button to the wellness API and visible feedback.
      setStatus({ type: "success", message: "Entry saved" });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

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
              <input
                name="stress_level"
                type="number"
                min="1"
                max="10"
                value={entry.stress_level}
                onChange={handleFieldChange}
              />
            </label>
            <label>
              Work hours
              <input
                name="work_hours"
                type="number"
                min="0"
                max="24"
                value={entry.work_hours}
                onChange={handleFieldChange}
              />
            </label>
            <label>
              Sleep hours
              <input
                name="sleep_hours"
                type="number"
                min="0"
                max="24"
                value={entry.sleep_hours}
                onChange={handleFieldChange}
              />
            </label>
            <label>
              Mood
              <select name="mood" value={entry.mood} onChange={handleFieldChange}>
                <option value="focused">Focused</option>
                <option value="calm">Calm</option>
                <option value="stretched">Stretched</option>
              </select>
            </label>
            <label>
              Energy level
              <input
                name="energy_level"
                type="number"
                min="1"
                max="10"
                value={entry.energy_level}
                onChange={handleFieldChange}
              />
            </label>
          </div>
          <button type="button" onClick={handleSaveEntry} disabled={status.type === "saving"}>
            {status.type === "saving" ? "Saving..." : "Save entry"}
          </button>
          {status.message ? <p className={`form-status ${status.type}`}>{status.message}</p> : null}
        </div>
      </section>
    </main>
  );
}
