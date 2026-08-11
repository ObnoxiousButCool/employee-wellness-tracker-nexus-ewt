/** Fixed option lists mirroring the backend's `Mood`/`EnergyLevel` enums, rendered as radio/select groups (never free text). */

export const MOOD_OPTIONS = Object.freeze([
  { value: "VERY_LOW", label: "Very low" },
  { value: "LOW", label: "Low" },
  { value: "NEUTRAL", label: "Neutral" },
  { value: "GOOD", label: "Good" },
  { value: "GREAT", label: "Great" },
]);

export const ENERGY_LEVEL_OPTIONS = Object.freeze([
  { value: "VERY_LOW", label: "Very low" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "VERY_HIGH", label: "Very high" },
]);
