"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchDashboardSummary } from "../../lib/dashboardApi";
import { fetchDepartments } from "../../lib/adminApi";
import { subscribeToWellnessEntrySubmitted } from "../../lib/wellnessEvents";
import DashboardScopeFilter from "./DashboardScopeFilter";
import KpiCards from "./KpiCards";
import WellnessStatusDistribution from "./WellnessStatusDistribution";
import DepartmentWellnessScores from "./DepartmentWellnessScores";
import WeeklyTrendChart from "./WeeklyTrendChart";
import TopHighStressList from "./TopHighStressList";

/**
 * Admin/Manager dashboard, consuming `GET /api/dashboard/summary` (S5). One
 * round trip returns the full KPI payload: KPI cards, wellness status
 * distribution, department wellness scores, the last 7 days of trend, and
 * the top-5 high-stress list. A MANAGER's scope is always forced to their
 * own department server-side, so the department selector is ADMIN-only,
 * matching the pattern `WellnessHistoryGrid` (S4) already uses for its
 * department filter.
 *
 * For an ADMIN who switches to "Single department" scope, the backend
 * requires a `departmentId` and 400s without one (S5 API Contract) -- so the
 * fetch is held back until a department is actually picked, rather than
 * firing immediately on every scope change.
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
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error | pending-department
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (role !== "ADMIN") return;
    fetchDepartments().then((result) => {
      if (result.ok) setDepartments(result.data.data || []);
    });
  }, [role]);

  const awaitingDepartmentPick = role === "ADMIN" && scope === "department" && !departmentId;

  const load = useCallback(async () => {
    if (awaitingDepartmentPick) {
      setSummary(null);
      setLoadState("pending-department");
      return;
    }

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
  }, [role, scope, departmentId, awaitingDepartmentPick]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => subscribeToWellnessEntrySubmitted(load), [load]);

  const filter = role === "ADMIN" && (
    <DashboardScopeFilter
      scope={scope}
      onScopeChange={setScope}
      departmentId={departmentId}
      onDepartmentIdChange={setDepartmentId}
      departments={departments}
    />
  );

  if (loadState === "loading" && !summary) {
    return (
      <section aria-label="Dashboard summary">
        {filter}
        <p role="status">Loading dashboard…</p>
      </section>
    );
  }

  if (loadState === "pending-department") {
    return (
      <section aria-label="Dashboard summary">
        {filter}
        <p>Select a department to view its dashboard.</p>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section aria-label="Dashboard summary">
        {filter}
        <div role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Dashboard summary">
      {filter}

      {summary && (
        <>
          <KpiCards cards={summary.kpiCards} />
          <WellnessStatusDistribution rows={summary.wellnessStatusDistribution} />
          <DepartmentWellnessScores rows={summary.departmentWellnessScores} />
          <WeeklyTrendChart points={summary.weeklyWellnessTrends} />
          <TopHighStressList employees={summary.topHighStressEmployees} />
        </>
      )}
    </section>
  );
}
