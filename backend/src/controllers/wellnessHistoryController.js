const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { validateWellnessHistoryQuery } = require("../utils/validators");
const { ENERGY_LEVEL_SCORE } = require("../utils/wellnessMetrics");
const { toDateOnlyString, parseDateOnly } = require("./wellnessEntriesController");

function serializeHistoryRow(row, userMap) {
  const user = userMap.get(row.userId);
  return {
    id: row.id,
    userId: row.userId,
    employeeName: user ? user.name : null,
    departmentId: user ? user.departmentId : null,
    entryDate: toDateOnlyString(row.entryDate),
    mood: row.mood,
    stressLevel: row.stressLevel,
    sleepHours: Number(row.sleepHours),
    energyScore: ENERGY_LEVEL_SCORE[row.energyLevel] ?? null,
  };
}

/**
 * GET /api/wellness/history?userId=&department=&from=&to=&mood=&page=&pageSize=&sortBy=&sortOrder=
 * ADMIN/MANAGER only (see wellnessRoutes.js). A MANAGER is always scoped to
 * their own department's employees server-side; a client-supplied
 * `department` query value is ignored entirely for a MANAGER caller — it is
 * never trusted to widen or redirect the scope. Defaults to sorting by
 * entry_date DESC; sortBy/sortOrder support the grid's column sort toggle.
 */
async function getHistory(req, res) {
  const errors = validateWellnessHistoryQuery(req.query);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const prisma = req.app.locals.prisma;
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const sortBy = req.query.sortBy || "entryDate";
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  if (req.user.role === "MANAGER" && req.user.departmentId == null) {
    return res.status(200).json({ data: [], pagination: buildPaginationMeta(page, pageSize, 0) });
  }

  const departmentId =
    req.user.role === "MANAGER"
      ? req.user.departmentId
      : req.query.department !== undefined
        ? Number.parseInt(req.query.department, 10)
        : undefined;

  const userMap = new Map();
  let allowedUserIds = null;
  if (departmentId !== undefined) {
    const scopedUsers = await prisma.user.findMany({ where: { departmentId } });
    allowedUserIds = scopedUsers.map((u) => u.id);
    for (const u of scopedUsers) userMap.set(u.id, u);
  }

  if (req.query.userId !== undefined) {
    const userId = Number.parseInt(req.query.userId, 10);
    if (allowedUserIds !== null && !allowedUserIds.includes(userId)) {
      return res.status(200).json({ data: [], pagination: buildPaginationMeta(page, pageSize, 0) });
    }
    allowedUserIds = [userId];
  }

  const entryWhere = {};
  if (allowedUserIds !== null) entryWhere.userId = { in: allowedUserIds };
  if (req.query.mood !== undefined) entryWhere.mood = req.query.mood;
  if (req.query.from !== undefined || req.query.to !== undefined) {
    entryWhere.entryDate = {};
    if (req.query.from !== undefined) entryWhere.entryDate.gte = parseDateOnly(req.query.from);
    if (req.query.to !== undefined) entryWhere.entryDate.lte = parseDateOnly(req.query.to);
  }

  const [rows, total] = await Promise.all([
    prisma.wellnessEntry.findMany({
      where: entryWhere,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    prisma.wellnessEntry.count({ where: entryWhere }),
  ]);

  const missingUserIds = [...new Set(rows.map((r) => r.userId).filter((id) => !userMap.has(id)))];
  if (missingUserIds.length > 0) {
    const extraUsers = await prisma.user.findMany({ where: { id: { in: missingUserIds } } });
    for (const u of extraUsers) userMap.set(u.id, u);
  }

  return res.status(200).json({
    data: rows.map((row) => serializeHistoryRow(row, userMap)),
    pagination: buildPaginationMeta(page, pageSize, total),
  });
}

module.exports = { getHistory, serializeHistoryRow };
