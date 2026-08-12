const { isPositiveIntegerString, validateWellnessScoresQuery } = require("../utils/validators");
const {
  calculateWellnessScore,
  calculateDepartmentWellnessScore,
  getClassificationCategory,
} = require("../utils/wellnessScoring");

/** Reduces a flat list of wellness_entries rows to the single most-recent row per userId. */
function latestEntryByUser(entries) {
  const latest = new Map();
  for (const entry of entries) {
    const current = latest.get(entry.userId);
    if (!current || entry.entryDate > current.entryDate) {
      latest.set(entry.userId, entry);
    }
  }
  return latest;
}

async function loadActiveEmployees(prisma, where) {
  const rows = await prisma.user.findMany({ where });
  return rows.filter((u) => u.role && u.role.name === "EMPLOYEE");
}

async function latestScoresByEmployee(prisma, employees) {
  const employeeIds = employees.map((e) => e.id);
  if (employeeIds.length === 0) return new Map();

  const entries = await prisma.wellnessEntry.findMany({ where: { userId: { in: employeeIds } } });
  const latestByUser = latestEntryByUser(entries);

  const scores = new Map();
  for (const [userId, entry] of latestByUser) {
    scores.set(userId, calculateWellnessScore(entry.stressLevel, Number(entry.sleepHours), entry.energyLevel));
  }
  return scores;
}

/**
 * GET /api/wellness/scores?department=
 * ADMIN/MANAGER only (see wellnessRoutes.js). A MANAGER's department is
 * always forced to their own server-side, ignoring any client-supplied
 * `department` -- the same "never trust client scope" rule
 * GET /api/wellness/history (S4) and GET /api/dashboard/summary (S5)
 * enforce. Returns each in-scope active EMPLOYEE's most recent wellness
 * score and classification; an employee with no entries yet has no score
 * to report and is omitted.
 */
async function getEmployeeWellnessScores(req, res) {
  const prisma = req.app.locals.prisma;
  const isManager = req.user.role === "MANAGER";

  let departmentId;
  if (isManager) {
    departmentId = req.user.departmentId;
    if (departmentId == null) {
      return res.status(200).json({ data: [] });
    }
  } else {
    const errors = validateWellnessScoresQuery(req.query);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }
    if (req.query.department !== undefined) {
      departmentId = Number.parseInt(req.query.department, 10);
      // Matches GET /api/departments/:departmentId/wellness/score's 404 on an
      // unknown department -- an ADMIN filtering this list by a nonexistent
      // department must not silently fall through to an empty { data: [] }.
      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
    }
  }

  const userWhere = { isActive: true };
  if (departmentId !== undefined) userWhere.departmentId = departmentId;

  const employees = await loadActiveEmployees(prisma, userWhere);
  const scores = await latestScoresByEmployee(prisma, employees);

  const data = employees
    .filter((e) => scores.has(e.id))
    .map((e) => {
      const score = scores.get(e.id);
      return { employeeId: e.id, score, classificationCategory: getClassificationCategory(score) };
    });

  return res.status(200).json({ data });
}

/**
 * GET /api/departments/:departmentId/wellness/score
 * ADMIN/MANAGER only. A MANAGER may only request their own department
 * (403 otherwise); ADMIN may request any department (404 if unknown).
 * Score is the mean of the latest wellness score per active employee in the
 * department (calculateDepartmentWellnessScore); null when no employee
 * there has any entries yet.
 */
async function getDepartmentWellnessScore(req, res) {
  if (!isPositiveIntegerString(req.params.departmentId)) {
    return res.status(400).json({ error: "Invalid departmentId" });
  }
  const departmentId = Number.parseInt(req.params.departmentId, 10);

  if (req.user.role === "MANAGER" && req.user.departmentId !== departmentId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const prisma = req.app.locals.prisma;
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    return res.status(404).json({ error: "Department not found" });
  }

  const employees = await loadActiveEmployees(prisma, { isActive: true, departmentId });
  const scores = await latestScoresByEmployee(prisma, employees);

  return res.status(200).json({
    departmentId,
    score: calculateDepartmentWellnessScore([...scores.values()]),
  });
}

module.exports = { getEmployeeWellnessScores, getDepartmentWellnessScore };
