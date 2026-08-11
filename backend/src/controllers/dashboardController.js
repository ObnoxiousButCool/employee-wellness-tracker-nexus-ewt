const { validateDashboardSummaryQuery } = require("../utils/validators");
const { average } = require("../utils/wellnessMetrics");
const {
  averageWellnessScore,
  WELLNESS_STATUS_CATEGORIES,
  classifyWellnessScore,
  ATTENTION_STRESS_THRESHOLD,
} = require("../utils/wellnessScore");
const { toDateOnlyString, parseDateOnly, todayDateString } = require("./wellnessEntriesController");

const TOP_HIGH_STRESS_LIMIT = 5;
const TREND_DAYS = 7;

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

/**
 * GET /api/dashboard/summary?scope=org|department&departmentId=
 * ADMIN/MANAGER only (see dashboardRoutes.js). A MANAGER's scope is always
 * forced to their own department server-side, ignoring any client-supplied
 * scope/departmentId entirely -- the same "never trust client scope" rule
 * GET /api/wellness/history enforces (S4). ADMIN may request scope=org
 * (all departments) or scope=department (a specific one).
 *
 * Returns the full KPI payload in one round trip: KPI cards, wellness
 * status distribution, department wellness scores, the last 7 days of
 * trend, and the top-5 high-stress list -- all computed over active
 * EMPLOYEE-role users within scope, no new tables (see Data Models).
 */
async function getSummary(req, res) {
  const errors = validateDashboardSummaryQuery(req.query);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const prisma = req.app.locals.prisma;
  const isManager = req.user.role === "MANAGER";

  let scope = isManager ? "department" : req.query.scope || "org";
  let departmentId;
  let targetDepartment;

  if (isManager) {
    departmentId = req.user.departmentId;
    if (departmentId == null) {
      return res.status(200).json(emptySummary(scope, null));
    }
    targetDepartment = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!targetDepartment) {
      return res.status(200).json(emptySummary(scope, departmentId));
    }
  } else if (scope === "department") {
    departmentId = Number.parseInt(req.query.departmentId, 10);
    targetDepartment = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!targetDepartment) {
      return res.status(404).json({ error: "Department not found" });
    }
  }

  const userWhere = { isActive: true };
  if (scope === "department") userWhere.departmentId = departmentId;

  const scopedUsers = (await prisma.user.findMany({ where: userWhere })).filter(
    (u) => u.role && u.role.name === "EMPLOYEE"
  );
  const userNameById = new Map(scopedUsers.map((u) => [u.id, u.name]));
  const employeeIds = scopedUsers.map((u) => u.id);

  const today = todayDateOnly();
  const weekStart = daysAgo(TREND_DAYS, today);

  let entriesToday = [];
  let weekEntries = [];
  if (employeeIds.length > 0) {
    [entriesToday, weekEntries] = await Promise.all([
      prisma.wellnessEntry.findMany({
        where: { userId: { in: employeeIds }, entryDate: { gte: today, lte: today } },
      }),
      prisma.wellnessEntry.findMany({
        where: { userId: { in: employeeIds }, entryDate: { gte: weekStart, lte: today } },
      }),
    ]);
  }

  const weekByUser = groupByUser(weekEntries);

  // KPI cards
  const totalActiveEmployees = employeeIds.length;
  const submissionsToday = entriesToday.length;
  const avgWellnessScore = averageWellnessScore(weekEntries);
  let employeesRequiringAttention = 0;
  for (const userEntries of weekByUser.values()) {
    const avgStress = average(userEntries.map((e) => e.stressLevel));
    if (avgStress !== null && avgStress >= ATTENTION_STRESS_THRESHOLD) employeesRequiringAttention += 1;
  }

  // Wellness status distribution -- only employees with at least one entry
  // in the trailing 7 days can be classified; an employee with no recent
  // data has no wellness score to bucket.
  const distributionCounts = new Map(WELLNESS_STATUS_CATEGORIES.map((c) => [c, 0]));
  for (const userEntries of weekByUser.values()) {
    const score = averageWellnessScore(userEntries);
    if (score === null) continue;
    const category = classifyWellnessScore(score);
    distributionCounts.set(category, distributionCounts.get(category) + 1);
  }
  const wellnessStatusDistribution = WELLNESS_STATUS_CATEGORIES.map((category) => ({
    category,
    count: distributionCounts.get(category),
  }));

  // Department wellness scores -- one row per department in scope.
  const departments =
    scope === "department" ? [targetDepartment] : await prisma.department.findMany({ where: { isActive: true } });

  const departmentWellnessScores = departments.map((dept) => {
    const deptUserIds = scopedUsers.filter((u) => u.departmentId === dept.id).map((u) => u.id);
    const deptEntries = weekEntries.filter((e) => deptUserIds.includes(e.userId));
    return {
      departmentId: dept.id,
      name: dept.name,
      score: averageWellnessScore(deptEntries),
      employeeCount: deptUserIds.length,
    };
  });

  // Weekly wellness trend -- last 7 days, oldest first, matching the
  // trend endpoint's ordering convention (S4).
  const weeklyWellnessTrends = [];
  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const dayEntries = weekEntries.filter((e) => e.entryDate.getTime() === day.getTime());
    weeklyWellnessTrends.push({ date: toDateOnlyString(day), score: averageWellnessScore(dayEntries) });
  }

  // Top-5 high-stress employees -- ranked by trailing-7-day average
  // stressLevel, ties broken by most recent submission.
  const highStressCandidates = [...weekByUser.entries()].map(([userId, userEntries]) => {
    const mostRecent = userEntries.reduce((max, e) => (e.entryDate > max ? e.entryDate : max), userEntries[0].entryDate);
    return {
      employeeId: userId,
      name: userNameById.get(userId) ?? null,
      stressLevel: average(userEntries.map((e) => e.stressLevel)),
      mostRecentEntryDate: mostRecent,
    };
  });
  highStressCandidates.sort((a, b) => {
    if (b.stressLevel !== a.stressLevel) return b.stressLevel - a.stressLevel;
    return b.mostRecentEntryDate - a.mostRecentEntryDate;
  });
  const topHighStressEmployees = highStressCandidates
    .slice(0, TOP_HIGH_STRESS_LIMIT)
    .map(({ employeeId, name, stressLevel }) => ({ employeeId, name, stressLevel }));

  return res.status(200).json({
    scope,
    departmentId: scope === "department" ? departmentId : null,
    kpiCards: buildKpiCards({ totalActiveEmployees, submissionsToday, avgWellnessScore, employeesRequiringAttention }),
    wellnessStatusDistribution,
    departmentWellnessScores,
    weeklyWellnessTrends,
    topHighStressEmployees,
  });
}

module.exports = { getSummary };
