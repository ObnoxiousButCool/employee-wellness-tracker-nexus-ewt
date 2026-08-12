"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchWellnessScores } from "../../lib/wellnessScoringApi";
import { fetchDepartments } from "../../lib/adminApi";

/**
 * Manager/Admin wellness scores list, consuming `GET /api/wellness/scores`.
 * A MANAGER's results are always scoped to their own department
 * server-side, so the department filter is ADMIN-only in this UI (the
 * backend ignores it entirely for a MANAGER caller, same pattern as
 * WellnessHistoryGrid.jsx/DashboardSummary.jsx). The S6 `WellnessScore`
 * response shape has no employee name field, so each row links to the
 * existing S4 employee profile screen labeled by id.
 * @param {{role: "ADMIN"|"MANAGER", profileBasePath: string}} props
 */
export default function WellnessDashboard({ role, profileBasePath }) {
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState([]);
  const [rows, setRows] = useState([]);
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

    const result = await fetchWellnessScores({ department: role === "ADMIN" ? department : "" });

    if (!result.ok) {
      setLoadState("error");
      setErrorMessage(result.data.error || "Unable to load wellness scores. Please try again.");
      return;
    }

    setRows(result.data.data || []);
    setLoadState("ready");
  }, [department, role]);

  useEffect(() => {
    load();
  }, [load]);

  function handleFilterSubmit(event) {
    event.preventDefault();
    load();
  }

  return (
    <section aria-label="Wellness scores">
      <h2>Wellness scores</h2>

      {role === "ADMIN" && (
        <form onSubmit={handleFilterSubmit}>
          <label htmlFor="scores-department-filter">Department</label>
          <select
            id="scores-department-filter"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="submit">Apply filter</button>
        </form>
      )}

      {loadState === "loading" && <p role="status">Loading wellness scores…</p>}

      {loadState === "error" && (
        <div role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loadState === "ready" && rows.length === 0 && <p>No wellness scores found.</p>}

      {loadState === "ready" && rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Score</th>
              <th>Classification</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId}>
                <td>
                  <Link href={`${profileBasePath}/employees/${row.employeeId}`}>#{row.employeeId}</Link>
                </td>
                <td>{row.score}</td>
                <td>{row.classificationCategory}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
