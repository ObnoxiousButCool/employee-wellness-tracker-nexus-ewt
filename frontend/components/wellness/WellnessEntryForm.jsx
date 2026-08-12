"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWellnessHistory, submitWellnessEntry } from "../../lib/wellnessApi";
import { MOOD_OPTIONS, ENERGY_LEVEL_OPTIONS } from "../../lib/wellnessOptions";
import { notifyWellnessEntrySubmitted } from "../../lib/wellnessEvents";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

const BLANK_FORM = { stressLevel: "", workHours: "", sleepHours: "", mood: "", energyLevel: "" };

/**
 * Daily wellness check-in form. `POST /api/wellness/entries` always
 * upserts the caller's row for the current calendar day, so on mount this
 * loads today's entry (if any) via `GET /api/wellness/entries/me` and
 * prefills the form for in-place editing; otherwise it renders blank
 * ("no entry submitted yet today" empty state). The date is never
 * user-editable, so a submission can never name a day other than today.
 */
export default function WellnessEntryForm() {
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [loadError, setLoadError] = useState("");
  const [existingEntryId, setExistingEntryId] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);

  const [submitState, setSubmitState] = useState("idle"); // idle | submitting | error | success
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitErrorMessage, setSubmitErrorMessage] = useState("");

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError("");

    const today = todayDateString();
    const result = await fetchWellnessHistory({ from: today, to: today });

    if (!result.ok) {
      setLoadState("error");
      setLoadError(result.data.error || "Unable to load today's entry. Please try again.");
      return;
    }

    const todaysEntry = (result.data.data || [])[0] || null;
    if (todaysEntry) {
      setExistingEntryId(todaysEntry.id);
      setForm({
        stressLevel: String(todaysEntry.stressLevel),
        workHours: String(todaysEntry.workHours),
        sleepHours: String(todaysEntry.sleepHours),
        mood: todaysEntry.mood,
        energyLevel: todaysEntry.energyLevel,
      });
    } else {
      setExistingEntryId(null);
      setForm(BLANK_FORM);
    }
    setLoadState("ready");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitState("submitting");
    setSubmitErrorMessage("");
    setFieldErrors({});

    const payload = {
      stressLevel: Number(form.stressLevel),
      workHours: Number(form.workHours),
      sleepHours: Number(form.sleepHours),
      mood: form.mood,
      energyLevel: form.energyLevel,
    };

    const result = await submitWellnessEntry(payload);

    if (!result.ok) {
      setSubmitState("error");
      if (result.status === 422 && result.data.errors) {
        setFieldErrors(result.data.errors);
      } else {
        setSubmitErrorMessage(result.data.error || "Unable to save your entry. Please try again.");
      }
      return;
    }

    setExistingEntryId(result.data.id);
    setSubmitState("success");
    notifyWellnessEntrySubmitted();
  }

  if (loadState === "loading") {
    return <p role="status">Loading today's entry…</p>;
  }

  if (loadState === "error") {
    return (
      <div role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Daily wellness check-in">
      <h2>{existingEntryId ? "Update today's check-in" : "Log today's check-in"}</h2>
      {!existingEntryId && <p>You haven't submitted a wellness entry for today yet.</p>}

      <form onSubmit={handleSubmit} aria-label="Wellness entry form">
        <div>
          <label htmlFor="stress-level">Stress level (1-10)</label>
          <input
            id="stress-level"
            type="number"
            min={1}
            max={10}
            step={1}
            required
            value={form.stressLevel}
            onChange={(e) => updateField("stressLevel", e.target.value)}
          />
          {fieldErrors.stressLevel && (
            <p role="alert" data-testid="error-stressLevel">
              {fieldErrors.stressLevel}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="work-hours">Work hours</label>
          <input
            id="work-hours"
            type="number"
            min={0}
            max={24}
            step={0.5}
            required
            value={form.workHours}
            onChange={(e) => updateField("workHours", e.target.value)}
          />
          {fieldErrors.workHours && (
            <p role="alert" data-testid="error-workHours">
              {fieldErrors.workHours}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="sleep-hours">Sleep hours</label>
          <input
            id="sleep-hours"
            type="number"
            min={0}
            max={24}
            step={0.5}
            required
            value={form.sleepHours}
            onChange={(e) => updateField("sleepHours", e.target.value)}
          />
          {fieldErrors.sleepHours && (
            <p role="alert" data-testid="error-sleepHours">
              {fieldErrors.sleepHours}
            </p>
          )}
        </div>

        <fieldset>
          <legend>Mood</legend>
          {MOOD_OPTIONS.map((option) => (
            <label key={option.value} htmlFor={`mood-${option.value}`}>
              <input
                id={`mood-${option.value}`}
                type="radio"
                name="mood"
                value={option.value}
                required
                checked={form.mood === option.value}
                onChange={(e) => updateField("mood", e.target.value)}
              />
              {option.label}
            </label>
          ))}
          {fieldErrors.mood && (
            <p role="alert" data-testid="error-mood">
              {fieldErrors.mood}
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend>Energy level</legend>
          {ENERGY_LEVEL_OPTIONS.map((option) => (
            <label key={option.value} htmlFor={`energy-${option.value}`}>
              <input
                id={`energy-${option.value}`}
                type="radio"
                name="energyLevel"
                value={option.value}
                required
                checked={form.energyLevel === option.value}
                onChange={(e) => updateField("energyLevel", e.target.value)}
              />
              {option.label}
            </label>
          ))}
          {fieldErrors.energyLevel && (
            <p role="alert" data-testid="error-energyLevel">
              {fieldErrors.energyLevel}
            </p>
          )}
        </fieldset>

        {submitState === "error" && submitErrorMessage && (
          <p role="alert" data-testid="submit-error">
            {submitErrorMessage}
          </p>
        )}
        {submitState === "success" && (
          <p role="status" data-testid="submit-success">
            Saved today's check-in.
          </p>
        )}

        <button type="submit" disabled={submitState === "submitting"}>
          {submitState === "submitting" ? "Saving..." : "Save check-in"}
        </button>
      </form>
    </section>
  );
}
