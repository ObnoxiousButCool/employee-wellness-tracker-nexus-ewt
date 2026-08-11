"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchEmployeeProfile } from "../../lib/wellnessReportsApi";
import TrendChart from "./TrendChart";

/**
 * Employee wellness profile: user info + summary stats, consuming
 * `GET /api/wellness/employees/:id/profile` (default range: last 30 days),
 * plus the trend chart for the same employee. Department scoping (a
 * MANAGER can only reach their own department's employees) is enforced by
 * the backend route handler; a 403/404 here surfaces the backend's message.
 * @param {{employeeId: number|string}} props
 */
export default function EmployeeProfile({ employeeId }) {
  const [profile, setProfile] = useState(null);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    const result = await fetchEmployeeProfile(employeeId);

    if (!result.ok) {
      setLoadState("error");
      setErrorMessage(result.data.error || "Unable to load this employee's profile. Please try again.");
      return;
    }

    setProfile(result.data);
    setLoadState("ready");
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section aria-label="Employee profile">
      {loadState === "loading" && <p role="status">Loading employee profile…</p>}

      {loadState === "error" && (
        <div role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loadState === "ready" && profile && (
        <>
          <h2>{profile.name}</h2>
          <p>Employee #{profile.id}</p>

          <h3>Summary ({profile.range.from} to {profile.range.to})</h3>
          {profile.stats.entryCount === 0 ? (
            <p>No wellness entries in this range.</p>
          ) : (
            <dl>
              <dt>Average stress level</dt>
              <dd>{profile.stats.avgStressLevel}</dd>
              <dt>Average sleep hours</dt>
              <dd>{profile.stats.avgSleepHours}</dd>
              <dt>Average energy score</dt>
              <dd>{profile.stats.avgEnergyScore}</dd>
              <dt>Entries in range</dt>
              <dd>{profile.stats.entryCount}</dd>
            </dl>
          )}

          <TrendChart employeeId={employeeId} />
        </>
      )}
    </section>
  );
}
