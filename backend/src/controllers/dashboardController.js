const { validateDashboardSummaryQuery } = require("../utils/validators");
const {
  todayDateOnly,
  daysAgo,
  groupByUser,
  TREND_DAYS,
  buildKpiSection,
  buildWellnessStatusDistribution,
  buildDepartmentWellnessScores,
  buildWeeklyWellnessTrends,
  buildTopHighStressEmployees,
  emptySummary,
} = require("../utils/dashboardMetrics");

/**
 * GET /api/dashboard/summary?scope=org|department&departmentId=
 * ADMIN/MANAGER only (see dashboardRoutes.js). A MANAGER's scope is always
 * forced to their own department server-side, ignoring any client-supplied
 * scope/departmentId entirely -- the same "never trust client scope" rule
 * GET /api/wellness/history enforces (S4). Because that value is ignored
 * outright for a MANAGER, it is never validated for one either: a malformed
 * scope/departmentId from a MANAGER must not 400, it must simply be
 * disregarded, so validation only runs for the ADMIN branch below.
 * ADMIN may request scope=org (all departments) or scope=department (a
 * specific one).
 *
 * Returns the full KPI payload in one round trip: KPI cards, wellness
 * status distribution, department wellness scores, the last 7 days of
 * trend, and the top-5 high-stress list -- all computed over active
 * EMPLOYEE-role users within scope, no new tables (see Data Models).
 */
async function getSummary(req, res) {
  const prisma = req.app.locals.prisma;
  const isManager = req.user.role === "MANAGER";

  let scope;
  let departmentId;
  let targetDepartment;

  if (isManager) {
    scope = "department";
    departmentId = req.user.departmentId;
    if (departmentId == null) {
      return res.status(200).json(emptySummary(scope, null));
    }
    targetDepartment = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!targetDepartment) {
      return res.status(200).json(emptySummary(scope, departmentId));
    }
  } else {
    const errors = validateDashboardSummaryQuery(req.query);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    scope = req.query.scope || "org";
    if (scope === "department") {
      departmentId = Number.parseInt(req.query.departmentId, 10);
      targetDepartment = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!targetDepartment) {
        return res.status(404).json({ error: "Department not found" });
      }
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

  const departments =
    scope === "department" ? [targetDepartment] : await prisma.department.findMany({ where: { isActive: true } });

  return res.status(200).json({
    scope,
    departmentId: scope === "department" ? departmentId : null,
    kpiCards: buildKpiSection({ totalActiveEmployees: employeeIds.length, entriesToday, weekEntries, weekByUser }),
    wellnessStatusDistribution: buildWellnessStatusDistribution(weekByUser),
    departmentWellnessScores: buildDepartmentWellnessScores({ departments, scopedUsers, weekEntries }),
    weeklyWellnessTrends: buildWeeklyWellnessTrends({ today, weekEntries }),
    topHighStressEmployees: buildTopHighStressEmployees({ weekByUser, userNameById }),
  });
}

module.exports = { getSummary };
