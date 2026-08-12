const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getEnergyScore,
  calculateWellnessScore,
  calculateDepartmentWellnessScore,
  getEmployeesRequiringAttention,
  getClassificationCategory,
  ATTENTION_STRESS_THRESHOLD,
  ATTENTION_WELLNESS_SCORE_THRESHOLD,
} = require("../src/utils/wellnessScoring");

test("getEnergyScore maps every EnergyLevel to its documented 0-100 value", () => {
  assert.equal(getEnergyScore("VERY_LOW"), 0);
  assert.equal(getEnergyScore("LOW"), 25);
  assert.equal(getEnergyScore("MEDIUM"), 50);
  assert.equal(getEnergyScore("HIGH"), 75);
  assert.equal(getEnergyScore("VERY_HIGH"), 100);
});

test("calculateWellnessScore returns 100 for the best possible inputs", () => {
  assert.equal(calculateWellnessScore(0, 8, "VERY_HIGH"), 100);
});

test("calculateWellnessScore returns 0 for the worst possible inputs", () => {
  assert.equal(calculateWellnessScore(10, 0, "VERY_LOW"), 0);
});

test("calculateWellnessScore clamps a negative raw value to 0", () => {
  // stressLevel above 10 pushes the stress component negative; the result
  // must still clamp to the documented [0, 100] range.
  assert.equal(calculateWellnessScore(15, 0, "VERY_LOW"), 0);
});

test("calculateWellnessScore caps the sleep component at 8 hours", () => {
  const eightHours = calculateWellnessScore(1, 8, "HIGH");
  const twelveHours = calculateWellnessScore(1, 12, "HIGH");
  assert.equal(eightHours, twelveHours);
});

test("calculateWellnessScore matches the documented weighted formula", () => {
  // round(0.4 * (100 - 5*10) + 0.3 * min(6/8, 1)*100 + 0.3 * 50)
  // = round(0.4*50 + 0.3*75 + 0.3*50) = round(20 + 22.5 + 15) = round(57.5) = 58
  assert.equal(calculateWellnessScore(5, 6, "MEDIUM"), 58);
});

test("calculateDepartmentWellnessScore returns the arithmetic mean of latest scores", () => {
  assert.equal(calculateDepartmentWellnessScore([80, 60, 40]), 60);
});

test("calculateDepartmentWellnessScore returns null when no employee has a score", () => {
  assert.equal(calculateDepartmentWellnessScore([]), null);
});

test("getClassificationCategory buckets scores into the four documented categories", () => {
  assert.equal(getClassificationCategory(0), "Critical");
  assert.equal(getClassificationCategory(39), "Critical");
  assert.equal(getClassificationCategory(40), "At Risk");
  assert.equal(getClassificationCategory(59), "At Risk");
  assert.equal(getClassificationCategory(60), "Stable");
  assert.equal(getClassificationCategory(79), "Stable");
  assert.equal(getClassificationCategory(80), "Thriving");
  assert.equal(getClassificationCategory(100), "Thriving");
});

test("getEmployeesRequiringAttention flags on high trailing-7-day stress alone", () => {
  const flagged = getEmployeesRequiringAttention([
    { employeeId: 1, avgStressLevel: ATTENTION_STRESS_THRESHOLD, avgWellnessScore: 90 },
    { employeeId: 2, avgStressLevel: ATTENTION_STRESS_THRESHOLD - 1, avgWellnessScore: 90 },
  ]);
  assert.deepEqual(flagged.map((e) => e.employeeId), [1]);
});

test("getEmployeesRequiringAttention flags on low trailing-7-day wellness score alone", () => {
  const flagged = getEmployeesRequiringAttention([
    { employeeId: 1, avgStressLevel: 1, avgWellnessScore: ATTENTION_WELLNESS_SCORE_THRESHOLD - 1 },
    { employeeId: 2, avgStressLevel: 1, avgWellnessScore: ATTENTION_WELLNESS_SCORE_THRESHOLD },
  ]);
  assert.deepEqual(flagged.map((e) => e.employeeId), [1]);
});

test("getEmployeesRequiringAttention never flags on a null (no-data) average", () => {
  const flagged = getEmployeesRequiringAttention([{ employeeId: 1, avgStressLevel: null, avgWellnessScore: null }]);
  assert.deepEqual(flagged, []);
});
