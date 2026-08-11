"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWellnessHistory } from "../../lib/wellnessApi";

/**
 * Lists the current user's own wellness history via
 * `GET /api/wellness/entries/me`, newest entry first (matching the
 * backend's ordering, not re-sorted client-side).
 */
export default function WellnessHistory() {
  const [entries, setEntries] = useState([]);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    const result = await fetchWellnessHistory();

    if (!result.ok) {
      setLoadState("error");
      setErrorMessage(result.data.error || "Unable to load your wellness history. Please try again.");
      return;
    }

    setEntries(result.data.data || []);
    setLoadState("ready");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section aria-label="Wellness history">
      <h2>Your wellness history</h2>

      {loadState === "loading" && <p role="status">Loading your wellness history…</p>}

      {loadState === "error" && (
        <div role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loadState === "ready" && entries.length === 0 && <p>No wellness entries yet.</p>}

      {loadState === "ready" && entries.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Stress</th>
              <th>Work hours</th>
              <th>Sleep hours</th>
              <th>Mood</th>
              <th>Energy level</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.entryDate}</td>
                <td>{entry.stressLevel}</td>
                <td>{entry.workHours}</td>
                <td>{entry.sleepHours}</td>
                <td>{entry.mood}</td>
                <td>{entry.energyLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
