"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchWellnessHistoryGrid } from "../../lib/wellnessReportsApi";
import { fetchDepartments } from "../../lib/adminApi";
import { MOOD_OPTIONS } from "../../lib/wellnessOptions";

const PAGE_SIZE = 20;
const SORTABLE_COLUMNS = [
  { key: "entryDate", label: "Date" },
  { key: "stressLevel", label: "Stress" },
  { key: "sleepHours", label: "Sleep hours" },
];

/**
 * Manager/Admin wellness history grid, consuming
 * `GET /api/wellness/history`. A MANAGER's results are always scoped to
 * their own department server-side (the department filter is ADMIN-only in
 * this UI since the backend ignores it entirely for a MANAGER caller).
 * @param {{role: "ADMIN"|"MANAGER", profileBasePath: string}} props
 */
export default function WellnessHistoryGrid({ role, profileBasePath }) {
  const [userId, setUserId] = useState("");
  const [department, setDepartment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mood, setMood] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("entryDate");
  const [sortOrder, setSortOrder] = useState("desc");

  const [departments, setDepartments] = useState([]);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
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

    const result = await fetchWellnessHistoryGrid({
      userId,
      department: role === "ADMIN" ? department : "",
      from,
      to,
      mood,
      page,
      pageSize: PAGE_SIZE,
      sortBy,
      sortOrder,
    });

    if (!result.ok) {
      setLoadState("error");
      setErrorMessage(result.data.error || (result.data.errors && Object.values(result.data.errors)[0]) || "Unable to load wellness history. Please try again.");
      return;
    }

    setRows(result.data.data || []);
    setPagination(result.data.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
    setLoadState("ready");
  }, [userId, department, from, to, mood, page, sortBy, sortOrder, role]);

  useEffect(() => {
    load();
  }, [load]);

  function handleFilterSubmit(event) {
    event.preventDefault();
    setPage(1);
    load();
  }

  function handleSort(columnKey) {
    if (sortBy === columnKey) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnKey);
      setSortOrder("desc");
    }
    setPage(1);
  }

  return (
    <section aria-label="Wellness history">
      <h2>Wellness history</h2>

      <form onSubmit={handleFilterSubmit}>
        <label htmlFor="history-userid-filter">Employee ID</label>
        <input
          id="history-userid-filter"
          type="number"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />

        {role === "ADMIN" && (
          <>
            <label htmlFor="history-department-filter">Department</label>
            <select
              id="history-department-filter"
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
          </>
        )}

        <label htmlFor="history-mood-filter">Mood</label>
        <select id="history-mood-filter" value={mood} onChange={(e) => setMood(e.target.value)}>
          <option value="">All moods</option>
          {MOOD_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <label htmlFor="history-from-filter">From</label>
        <input id="history-from-filter" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />

        <label htmlFor="history-to-filter">To</label>
        <input id="history-to-filter" type="date" value={to} onChange={(e) => setTo(e.target.value)} />

        <button type="submit">Apply filters</button>
      </form>

      {loadState === "loading" && <p role="status">Loading wellness history…</p>}

      {loadState === "error" && (
        <div role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loadState === "ready" && rows.length === 0 && <p>No wellness entries found.</p>}

      {loadState === "ready" && rows.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                {SORTABLE_COLUMNS.map((col) => (
                  <th key={col.key}>
                    <button type="button" onClick={() => handleSort(col.key)}>
                      {col.label}
                      {sortBy === col.key ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                    </button>
                  </th>
                ))}
                <th>Employee</th>
                <th>Mood</th>
                <th>Energy score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.entryDate}</td>
                  <td>{row.stressLevel}</td>
                  <td>{row.sleepHours}</td>
                  <td>
                    <Link href={`${profileBasePath}/employees/${row.userId}`}>
                      {row.employeeName || `#${row.userId}`}
                    </Link>
                  </td>
                  <td>{row.mood}</td>
                  <td>{row.energyScore ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div aria-label="Pagination">
            <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
