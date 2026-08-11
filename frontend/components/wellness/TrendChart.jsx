"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchEmployeeTrend } from "../../lib/wellnessReportsApi";

const METRIC_OPTIONS = [
  { value: "stress", label: "Stress level" },
  { value: "sleep", label: "Sleep hours" },
  { value: "energy", label: "Energy score" },
];

const RANGE_OPTIONS = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const CHART_WIDTH = 480;
const CHART_HEIGHT = 160;

function buildPolylinePoints(data) {
  if (data.length === 0) return "";
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = data.length > 1 ? CHART_WIDTH / (data.length - 1) : 0;

  return data
    .map((d, i) => {
      const x = data.length > 1 ? i * stepX : CHART_WIDTH / 2;
      const y = CHART_HEIGHT - ((d.value - min) / span) * CHART_HEIGHT;
      return `${x},${y}`;
    })
    .join(" ");
}

/**
 * Time-series trend chart for a single employee, consuming
 * `GET /api/wellness/employees/:id/trend`. The backend already returns one
 * pre-aggregated point per day in range, so this renders the series as-is
 * (no client-side re-bucketing).
 * @param {{employeeId: number|string}} props
 */
export default function TrendChart({ employeeId }) {
  const [metric, setMetric] = useState("stress");
  const [range, setRange] = useState("30d");
  const [data, setData] = useState([]);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    const result = await fetchEmployeeTrend(employeeId, { metric, range });

    if (!result.ok) {
      setLoadState("error");
      setErrorMessage(result.data.error || "Unable to load the trend chart. Please try again.");
      return;
    }

    setData(result.data.data || []);
    setLoadState("ready");
  }, [employeeId, metric, range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section aria-label="Wellness trend">
      <h3>Trend</h3>

      <label htmlFor="trend-metric">Metric</label>
      <select id="trend-metric" value={metric} onChange={(e) => setMetric(e.target.value)}>
        {METRIC_OPTIONS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <label htmlFor="trend-range">Range</label>
      <select id="trend-range" value={range} onChange={(e) => setRange(e.target.value)}>
        {RANGE_OPTIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      {loadState === "loading" && <p role="status">Loading trend…</p>}

      {loadState === "error" && (
        <div role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loadState === "ready" && data.length === 0 && <p>No wellness entries in this range.</p>}

      {loadState === "ready" && data.length > 0 && (
        <>
          <svg
            role="img"
            aria-label={`${metric} trend over ${range}`}
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          >
            <polyline points={buildPolylinePoints(data)} fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{point.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
