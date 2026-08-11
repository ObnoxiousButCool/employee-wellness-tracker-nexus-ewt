const { validateDateRangeQuery, validateTrendQuery } = require("../utils/validators");
const { ENERGY_LEVEL_SCORE, average } = require("../utils/wellnessMetrics");
const { toDateOnlyString, parseDateOnly } = require("./wellnessEntriesController");

const DEFAULT_PROFILE_RANGE_DAYS = 30;
const TREND_RANGE_DAYS = { "30d": 30, "90d": 90 };

const METRIC_PICKERS = {
  stress: (e) => e.stressLevel,
  sleep: (e) => Number(e.sleepHours),
  energy: (e) => ENERGY_LEVEL_SCORE[e.energyLevel],
};

// entryDate is a @db.Date column, always stored at local midnight (see
// wellnessEntriesController.js). Both range bounds below must be aligned to
// local calendar-day boundaries (not the current time-of-day new Date()
// carries), or the earliest day of a default 30d/90d window is silently
// dropped whenever the request happens later than midnight.
function daysAgo(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

function todayDateOnly() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * GET /api/wellness/employees/:id/profile?from=&to=
 * ADMIN/MANAGER only, department-scoped by enforceEmployeeDepartmentScope
 * (see wellnessRoutes.js), which attaches req.targetEmployee. Defaults to
 * the last 30 days when from/to are omitted.
 */
async function getProfile(req, res) {
  const errors = validateDateRangeQuery(req.query);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const prisma = req.app.locals.prisma;
  const employee = req.targetEmployee;

  const from = req.query.from !== undefined ? parseDateOnly(req.query.from) : daysAgo(DEFAULT_PROFILE_RANGE_DAYS);
  const to = req.query.to !== undefined ? parseDateOnly(req.query.to) : todayDateOnly();

  const entries = await prisma.wellnessEntry.findMany({
    where: { userId: employee.id, entryDate: { gte: from, lte: to } },
  });

  return res.status(200).json({
    id: employee.id,
    name: employee.name,
    departmentId: employee.departmentId,
    range: { from: toDateOnlyString(from), to: toDateOnlyString(to) },
    stats: {
      avgStressLevel: average(entries.map((e) => e.stressLevel)),
      avgSleepHours: average(entries.map((e) => Number(e.sleepHours))),
      avgEnergyScore: average(entries.map((e) => ENERGY_LEVEL_SCORE[e.energyLevel])),
      entryCount: entries.length,
    },
  });
}

/**
 * GET /api/wellness/employees/:id/trend?metric=stress|sleep|energy&range=30d|90d
 * ADMIN/MANAGER only, department-scoped by enforceEmployeeDepartmentScope.
 * Returns one point per existing entry in range (at most one entry per day,
 * enforced by the wellness_entries unique constraint), so this is already
 * pre-aggregated server-side — the chart layer never receives raw rows
 * beyond what it will actually plot.
 */
async function getTrend(req, res) {
  const errors = validateTrendQuery(req.query);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const prisma = req.app.locals.prisma;
  const employee = req.targetEmployee;
  const days = TREND_RANGE_DAYS[req.query.range];
  const from = daysAgo(days);
  const to = todayDateOnly();

  const entries = await prisma.wellnessEntry.findMany({
    where: { userId: employee.id, entryDate: { gte: from, lte: to } },
    orderBy: { entryDate: "asc" },
  });

  const pick = METRIC_PICKERS[req.query.metric];
  return res.status(200).json({
    data: entries.map((e) => ({ date: toDateOnlyString(e.entryDate), value: pick(e) })),
  });
}

module.exports = { getProfile, getTrend };
