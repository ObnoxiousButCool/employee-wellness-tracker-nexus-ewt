const { average } = require("./wellnessMetrics");

/**
 * energy_level -> numeric score mapping used by calculateWellnessScore
 * (S6's formal 0-100 composite). Deliberately separate from
 * wellnessMetrics.ENERGY_LEVEL_SCORE (1-5), which the S4/S5 history/trend/
 * dashboard aggregates already ship against -- this story's technical plan
 * specifies its own 0-100 scale, so the two mappings do not share a table.
 */
const ENERGY_LEVEL_NUMERIC_SCORE = {
  VERY_LOW: 0,
  LOW: 25,
  MEDIUM: 50,
  HIGH: 75,
  VERY_HIGH: 100,
};

/** Maps an EnergyLevel enum value to its 0-100 numeric score. */
function getEnergyScore(energyLevel) {
  return ENERGY_LEVEL_NUMERIC_SCORE[energyLevel];
}

const WELLNESS_SCORE_WEIGHTS = { stress: 0.4, sleep: 0.3, energy: 0.3 };
const SLEEP_TARGET_HOURS = 8;

/**
 * 0-100 composite wellness score for a single day's inputs: a weighted
 * combination of inverted stress, sleep adequacy (capped at the 8h healthy
 * target), and the mapped energy score -- rounded to the nearest integer
 * and clamped to [0, 100].
 */
function calculateWellnessScore(stressLevel, sleepHours, energyLevel) {
  const stressComponent = 100 - stressLevel * 10;
  const sleepComponent = Math.min(sleepHours / SLEEP_TARGET_HOURS, 1) * 100;
  const energyComponent = getEnergyScore(energyLevel);

  const raw =
    WELLNESS_SCORE_WEIGHTS.stress * stressComponent +
    WELLNESS_SCORE_WEIGHTS.sleep * sleepComponent +
    WELLNESS_SCORE_WEIGHTS.energy * energyComponent;

  return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * Arithmetic mean of the latest wellness score per active employee in a
 * department. Takes one already-deduplicated score per employee (never per
 * entry, to avoid over-weighting frequent submitters) -- the caller is
 * responsible for reducing each employee's entries down to their single
 * latest score before calling this. Returns null when there is nothing to
 * average.
 */
function calculateDepartmentWellnessScore(latestScoresByEmployee) {
  return average(latestScoresByEmployee);
}

/** Trailing-7-day average stressLevel at/above this is "requires attention". */
const ATTENTION_STRESS_THRESHOLD = 8;
/** Trailing-7-day average wellness score below this is "requires attention". */
const ATTENTION_WELLNESS_SCORE_THRESHOLD = 40;

/**
 * Flags employees whose trailing-7-day average stress level meets/exceeds
 * ATTENTION_STRESS_THRESHOLD, OR whose trailing-7-day average wellness score
 * is below ATTENTION_WELLNESS_SCORE_THRESHOLD. Operates on already-aggregated
 * per-employee averages (`{ employeeId, avgStressLevel, avgWellnessScore }`,
 * each nullable when an employee has no entries in the window) -- computing
 * those averages from raw entries is the caller's job, so this stays a pure
 * function over numbers already reduced.
 */
function getEmployeesRequiringAttention(employees) {
  return employees.filter(({ avgStressLevel, avgWellnessScore }) => {
    const highStress = avgStressLevel != null && avgStressLevel >= ATTENTION_STRESS_THRESHOLD;
    const lowScore = avgWellnessScore != null && avgWellnessScore < ATTENTION_WELLNESS_SCORE_THRESHOLD;
    return highStress || lowScore;
  });
}

const CLASSIFICATION_CATEGORIES = {
  CRITICAL: "Critical",
  AT_RISK: "At Risk",
  STABLE: "Stable",
  THRIVING: "Thriving",
};

/** Buckets a 0-100 wellness score: Critical(<40), At Risk(40-59), Stable(60-79), Thriving(80-100). */
function getClassificationCategory(score) {
  if (score < 40) return CLASSIFICATION_CATEGORIES.CRITICAL;
  if (score < 60) return CLASSIFICATION_CATEGORIES.AT_RISK;
  if (score < 80) return CLASSIFICATION_CATEGORIES.STABLE;
  return CLASSIFICATION_CATEGORIES.THRIVING;
}

module.exports = {
  ENERGY_LEVEL_NUMERIC_SCORE,
  getEnergyScore,
  calculateWellnessScore,
  calculateDepartmentWellnessScore,
  ATTENTION_STRESS_THRESHOLD,
  ATTENTION_WELLNESS_SCORE_THRESHOLD,
  getEmployeesRequiringAttention,
  CLASSIFICATION_CATEGORIES,
  getClassificationCategory,
};
