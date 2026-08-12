"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchDashboardSummary } from "../../lib/dashboardApi";
import { fetchDepartments } from "../../lib/adminApi";
import { subscribeToWellnessEntrySubmitted } from "../../lib/wellnessEvents";

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

/**
 * Admin/Manager dashboard, consuming `GET /api/dashboard/summary` (S5). One
 * round trip returns the full KPI payload: KPI cards, wellness status
 * distribution, department wellness scores, the last 7 days of trend, and
 * the top-5 high-stress list. A MANAGER's scope is always forced to their
 * own department server-side, so the department selector below is
 * ADMIN-only, matching the pattern `WellnessHistoryGrid` (S4) already uses
 * for its department filter.
 *
 * Refetches automatically after a successful wellness submission
 * (`POST /api/wellness/entries`, S3) via `wellnessEvents.js`'s same-tab
 * pub/sub, so the numbers never require a manual page reload to catch up
 * -- no polling loop.
 * @param {{role: "ADMIN"|"MANAGER"}} props
 */
export default function DashboardSummary({ role }) {
  const [scope, setScope] = useState("org");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState([]);

  const [summary, setSummary] = useState(null);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (role !== "ADMIN") return;
    fetchDepartments().then((result) => {
      if (result.ok) setDepartments(result.data.data || []);
    });
  }, [role]);

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    const result = await fetchDashboardSummary({
      scope: role === "ADMIN" ? scope : "org",
      departmentId: role === "ADMIN" && scope === "department" ? departmentId : "",
    });

    if (!result.ok) {
      setLoadState("error");
      setErrorMessage(
        result.data.error || (result.data.errors && Object.values(result.data.errors)[0]) || "Unable to load the dashboard. Please try again."
      );
      return;
    }

    setSummary(result.data);
    setLoadState("ready");
  }, [role, scope, departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => subscribeToWellnessEntrySubmitted(load), [load]);

  if (loadState === "loading" && !summary) {
    return <p role="status">Loading dashboard…</p>;
  }

  if (loadState === "error") {
    return (
      <div role="alert">
        <p>{errorMessage}</p>
        <button type="button" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Dashboard summary">
      {role === "ADMIN" && (
        <form
          onSubmit={(e) => e.preventDefault()}
          aria-label="Dashboard scope filter"
        >
          <label htmlFor="dashboard-scope">Scope</label>
          <select id="dashboard-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="org">Organization-wide</option>
            <option value="department">Single department</option>
          </select>

          {scope === "department" && (
            <>
              <label htmlFor="dashboard-department">Department</label>
              <select
                id="dashboard-department"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
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
      )}

      {summary && (
        <>
          <ul aria-label="KPI cards">
            {summary.kpiCards.map((card) => (
              <li key={card.name}>
                <h3>{card.name}</h3>
                <p data-testid={`kpi-${card.name}`}>{card.value === null ? "—" : card.value}</p>
                <p>{card.description}</p>
              </li>
            ))}
          </ul>

          <section aria-label="Wellness status distribution">
            <h3>Wellness status distribution</h3>
            {summary.wellnessStatusDistribution.every((row) => row.count === 0) ? (
              <p>No employees have submitted a wellness entry in the last 7 days.</p>
            ) : (
              <ul>
                {summary.wellnessStatusDistribution.map((row) => (
                  <li key={row.category}>
                    {row.category}: {row.count}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Department wellness scores">
            <h3>Department wellness scores</h3>
            {summary.departmentWellnessScores.length === 0 ? (
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
                  {summary.departmentWellnessScores.map((row) => (
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

          <section aria-label="Weekly wellness trend">
            <h3>Weekly wellness trend</h3>
            {summary.weeklyWellnessTrends.every((point) => point.score === null) ? (
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
                  <polyline
                    points={buildPolylinePoints(summary.weeklyWellnessTrends)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.weeklyWellnessTrends.map((point) => (
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

          <section aria-label="Top 5 high stress employees">
            <h3>Top 5 high-stress employees</h3>
            {summary.topHighStressEmployees.length === 0 ? (
              <p>No employees with entries in the last 7 days.</p>
            ) : (
              <ol>
                {summary.topHighStressEmployees.map((employee) => (
                  <li key={employee.employeeId}>
                    {employee.name ?? `Employee #${employee.employeeId}`} — stress {employee.stressLevel}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </section>
  );
}
