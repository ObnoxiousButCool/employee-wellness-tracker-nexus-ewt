const { ENERGY_LEVEL_SCORE, average } = require("./wellnessMetrics");

/**
 * Composite 0-100 "wellness score" for a single entry: the mean of three
 * normalized components -- inverted stress (lower stress -> higher score),
 * energy level, and sleep adequacy (capped at 8h as the healthy target). No
 * such field exists on wellness_entries (S3) or anywhere in the API
 * Contract yet, so the dashboard computes it at request time, the same
 * "read-model shape, not a new table" approach S4 used for
 * WellnessHistory/EmployeeProfile.
 */
function computeWellnessScore(entry) {
  const stressComponent = ((11 - entry.stressLevel) / 10) * 100;
  const energyComponent = (ENERGY_LEVEL_SCORE[entry.energyLevel] / 5) * 100;
  const sleepComponent = (Math.min(Number(entry.sleepHours), 8) / 8) * 100;
  return (stressComponent + energyComponent + sleepComponent) / 3;
}

/** Average wellness score across a set of entries; null when entries is empty. */
function averageWellnessScore(entries) {
  return average(entries.map(computeWellnessScore));
}

/**
 * Provisional wellness-status buckets and "requires attention" threshold.
 * S6 (not yet built) owns the authoritative classification/threshold rules
 * referenced by this story's technical plan; until then the dashboard uses
 * these as its best-effort stand-in, named as constants so a future S6
 * change only has to touch this file.
 */
const WELLNESS_STATUS_CATEGORIES = ["THRIVING", "STABLE", "AT_RISK", "CRITICAL"];

function classifyWellnessScore(score) {
  if (score >= 75) return "THRIVING";
  if (score >= 50) return "STABLE";
  if (score >= 25) return "AT_RISK";
  return "CRITICAL";
}

/** Trailing-7-day average stressLevel at/above this is "requires attention". */
const ATTENTION_STRESS_THRESHOLD = 7;

module.exports = {
  computeWellnessScore,
  averageWellnessScore,
  WELLNESS_STATUS_CATEGORIES,
  classifyWellnessScore,
  ATTENTION_STRESS_THRESHOLD,
};
