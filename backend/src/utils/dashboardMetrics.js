const { average } = require("./wellnessMetrics");
const {
  averageWellnessScore,
  WELLNESS_STATUS_CATEGORIES,
  classifyWellnessScore,
  ATTENTION_STRESS_THRESHOLD,
} = require("./wellnessScore");
const { toDateOnlyString, parseDateOnly, todayDateString } = require("../controllers/wellnessEntriesController");

const TOP_HIGH_STRESS_LIMIT = 5;
const TREND_DAYS = 7;

/**
 * Pure per-section builder functions for GET /api/dashboard/summary. Each
 * function takes already-fetched rows (users/entries) and derives one
 * response section -- no Prisma calls here, so these are unit-testable
 * without a fake DB and keep dashboardController.js focused on
 * request/scope orchestration only.
 */

function todayDateOnly() {
  return parseDateOnly(todayDateString());
}

function daysAgo(days, from) {
  const d = new Date(from);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

/** Groups a flat list of wellness_entries rows by userId. */
function groupByUser(entries) {
  const byUser = new Map();
  for (const entry of entries) {
    if (!byUser.has(entry.userId)) byUser.set(entry.userId, []);
    byUser.get(entry.userId).push(entry);
  }
  return byUser;
}

function buildKpiCards({ totalActiveEmployees, submissionsToday, avgWellnessScore, employeesRequiringAttention }) {
  return [
    {
      name: "Total Active Employees",
      value: totalActiveEmployees,
      description: "Active employees within the selected scope",
    },
    {
      name: "Submissions Today",
      value: submissionsToday,
      description: "Wellness check-ins submitted today within the selected scope",
    },
    {
      name: "Average Wellness Score",
      value: avgWellnessScore,
      description: "Average wellness score over the trailing 7 days within the selected scope",
    },
    {
      name: "Employees Requiring Attention",
      value: employeesRequiringAttention,
      description: "Employees whose trailing 7-day average stress level meets or exceeds the attention threshold",
    },
  ];
}

/** Derives the four KPI cards from entriesToday/weekEntries (grouped by user). */
function buildKpiSection({ totalActiveEmployees, entriesToday, weekEntries, weekByUser }) {
  const submissionsToday = entriesToday.length;
  const avgWellnessScore = averageWellnessScore(weekEntries);
  let employeesRequiringAttention = 0;
  for (const userEntries of weekByUser.values()) {
    const avgStress = average(userEntries.map((e) => e.stressLevel));
    if (avgStress !== null && avgStress >= ATTENTION_STRESS_THRESHOLD) employeesRequiringAttention += 1;
  }
  return buildKpiCards({ totalActiveEmployees, submissionsToday, avgWellnessScore, employeesRequiringAttention });
}

/**
 * Only employees with at least one entry in the trailing 7 days can be
 * classified; an employee with no recent data has no wellness score to
 * bucket (no fifth "unclassified" category).
 */
function buildWellnessStatusDistribution(weekByUser) {
  const distributionCounts = new Map(WELLNESS_STATUS_CATEGORIES.map((c) => [c, 0]));
  for (const userEntries of weekByUser.values()) {
    const score = averageWellnessScore(userEntries);
    if (score === null) continue;
    const category = classifyWellnessScore(score);
    distributionCounts.set(category, distributionCounts.get(category) + 1);
  }
  return WELLNESS_STATUS_CATEGORIES.map((category) => ({
    category,
    count: distributionCounts.get(category),
  }));
}

/** One row per department in scope. */
function buildDepartmentWellnessScores({ departments, scopedUsers, weekEntries }) {
  return departments.map((dept) => {
    const deptUserIds = scopedUsers.filter((u) => u.departmentId === dept.id).map((u) => u.id);
    const deptEntries = weekEntries.filter((e) => deptUserIds.includes(e.userId));
    return {
      departmentId: dept.id,
      name: dept.name,
      score: averageWellnessScore(deptEntries),
      employeeCount: deptUserIds.length,
    };
  });
}

/** Last 7 days, oldest first, matching the trend endpoint's ordering convention (S4). */
function buildWeeklyWellnessTrends({ today, weekEntries }) {
  const weeklyWellnessTrends = [];
  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const dayEntries = weekEntries.filter((e) => e.entryDate.getTime() === day.getTime());
    weeklyWellnessTrends.push({ date: toDateOnlyString(day), score: averageWellnessScore(dayEntries) });
  }
  return weeklyWellnessTrends;
}

/** Ranked by trailing-7-day average stressLevel, ties broken by most recent submission. */
function buildTopHighStressEmployees({ weekByUser, userNameById }) {
  const candidates = [...weekByUser.entries()].map(([userId, userEntries]) => {
    const mostRecent = userEntries.reduce((max, e) => (e.entryDate > max ? e.entryDate : max), userEntries[0].entryDate);
    return {
      employeeId: userId,
      name: userNameById.get(userId) ?? null,
      stressLevel: average(userEntries.map((e) => e.stressLevel)),
      mostRecentEntryDate: mostRecent,
    };
  });
  candidates.sort((a, b) => {
    if (b.stressLevel !== a.stressLevel) return b.stressLevel - a.stressLevel;
    return b.mostRecentEntryDate - a.mostRecentEntryDate;
  });
  return candidates.slice(0, TOP_HIGH_STRESS_LIMIT).map(({ employeeId, name, stressLevel }) => ({
    employeeId,
    name,
    stressLevel,
  }));
}

function emptySummary(scope, departmentId) {
  return {
    scope,
    departmentId: departmentId ?? null,
    kpiCards: buildKpiCards({ totalActiveEmployees: 0, submissionsToday: 0, avgWellnessScore: null, employeesRequiringAttention: 0 }),
    wellnessStatusDistribution: WELLNESS_STATUS_CATEGORIES.map((category) => ({ category, count: 0 })),
    departmentWellnessScores: [],
    weeklyWellnessTrends: [],
    topHighStressEmployees: [],
  };
}

module.exports = {
  TREND_DAYS,
  todayDateOnly,
  daysAgo,
  groupByUser,
  buildKpiSection,
  buildWellnessStatusDistribution,
  buildDepartmentWellnessScores,
  buildWeeklyWellnessTrends,
  buildTopHighStressEmployees,
  emptySummary,
};
