"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchDepartmentWellnessScore } from "../../lib/wellnessScoringApi";

/**
 * Department wellness score screen, consuming
 * `GET /api/departments/:departmentId/wellness/score`. `score: null` means
 * no employee in the department has submitted a wellness entry yet -- shown
 * as an explicit message rather than a misleading `0`.
 * @param {{departmentId: number|string}} props
 */
export default function DepartmentWellness({ departmentId }) {
  const [score, setScore] = useState(null);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    const result = await fetchDepartmentWellnessScore(departmentId);

    if (!result.ok) {
      setLoadState("error");
      setErrorMessage(result.data.error || "Unable to load this department's wellness score. Please try again.");
      return;
    }

    setScore(result.data);
    setLoadState("ready");
  }, [departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section aria-label="Department wellness score">
      <h2>Department wellness score</h2>

      {loadState === "loading" && <p role="status">Loading department wellness score…</p>}

      {loadState === "error" && (
        <div role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loadState === "ready" && score && score.score === null && (
        <p>No employees in this department have submitted a wellness entry yet.</p>
      )}

      {loadState === "ready" && score && score.score !== null && (
        <p>
          Department #{score.departmentId} wellness score: <strong>{score.score}</strong>
        </p>
      )}
    </section>
  );
}
