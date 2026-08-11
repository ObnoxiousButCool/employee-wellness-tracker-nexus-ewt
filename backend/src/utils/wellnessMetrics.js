// EnergyLevel is stored as an enum (no numeric column), but manager-facing
// aggregates/trend charts need a numeric "energy score" to average/plot.
// This mapping is the single source of truth for that conversion so the
// history grid, profile stats, and trend chart never drift apart.
const ENERGY_LEVEL_SCORE = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  VERY_HIGH: 5,
};

/** Rounds to 2 decimal places; returns null for an empty input (no entries in range). */
function average(values) {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

module.exports = { ENERGY_LEVEL_SCORE, average };
