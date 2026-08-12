const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeWellnessScore,
  averageWellnessScore,
  classifyWellnessScore,
  ATTENTION_STRESS_THRESHOLD,
} = require("../src/utils/wellnessScore");

test("computeWellnessScore returns 100 for the best possible entry", () => {
  const score = computeWellnessScore({ stressLevel: 1, sleepHours: 8, energyLevel: "VERY_HIGH" });
  assert.equal(score, 100);
});

test("computeWellnessScore returns a low score for the worst possible entry", () => {
  const score = computeWellnessScore({ stressLevel: 10, sleepHours: 0, energyLevel: "VERY_LOW" });
  assert.equal(Math.round(score * 100) / 100, 10);
});

test("computeWellnessScore caps the sleep component at 8 hours", () => {
  const eightHours = computeWellnessScore({ stressLevel: 1, sleepHours: 8, energyLevel: "VERY_HIGH" });
  const twelveHours = computeWellnessScore({ stressLevel: 1, sleepHours: 12, energyLevel: "VERY_HIGH" });
  assert.equal(eightHours, twelveHours);
});

test("averageWellnessScore returns null for an empty entry list", () => {
  assert.equal(averageWellnessScore([]), null);
});

test("classifyWellnessScore buckets scores into the four provisional categories", () => {
  assert.equal(classifyWellnessScore(90), "THRIVING");
  assert.equal(classifyWellnessScore(60), "STABLE");
  assert.equal(classifyWellnessScore(30), "AT_RISK");
  assert.equal(classifyWellnessScore(10), "CRITICAL");
});

test("ATTENTION_STRESS_THRESHOLD is the documented trailing-7-day average stress cutoff", () => {
  assert.equal(ATTENTION_STRESS_THRESHOLD, 7);
});
