const { validateWellnessEntry, validateDateRangeQuery } = require("../utils/validators");

function toDateOnlyString(date) {
  return date instanceof Date ? date.toISOString().slice(0, 10) : date;
}

function serializeEntry(row) {
  return {
    id: row.id,
    userId: row.userId,
    entryDate: toDateOnlyString(row.entryDate),
    stressLevel: row.stressLevel,
    workHours: Number(row.workHours),
    sleepHours: Number(row.sleepHours),
    mood: row.mood,
    energyLevel: row.energyLevel,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/wellness/entries
 * Upserts the current user's entry for today. An entry is only ever
 * editable on the calendar day it belongs to, enforced here (not just
 * hidden in the UI): a request naming a different day is rejected with 403.
 */
async function upsertEntry(req, res) {
  const errors = validateWellnessEntry(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ errors });
  }

  const today = todayDateString();
  if (req.body.entryDate !== undefined && req.body.entryDate !== today) {
    return res.status(403).json({ error: "Entries can only be created or edited for the current day" });
  }

  const prisma = req.app.locals.prisma;
  const userId = req.user.userId;
  const entryDate = new Date(`${today}T00:00:00.000Z`);

  const saved = await prisma.wellnessEntry.upsert({
    where: { userId_entryDate: { userId, entryDate } },
    create: {
      userId,
      entryDate,
      stressLevel: req.body.stressLevel,
      workHours: req.body.workHours,
      sleepHours: req.body.sleepHours,
      mood: req.body.mood,
      energyLevel: req.body.energyLevel,
    },
    update: {
      stressLevel: req.body.stressLevel,
      workHours: req.body.workHours,
      sleepHours: req.body.sleepHours,
      mood: req.body.mood,
      energyLevel: req.body.energyLevel,
    },
  });

  return res.status(200).json(serializeEntry(saved));
}

/** GET /api/wellness/entries/me?from=&to= */
async function listMyEntries(req, res) {
  const errors = validateDateRangeQuery(req.query);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const prisma = req.app.locals.prisma;
  const where = { userId: req.user.userId };
  if (req.query.from !== undefined || req.query.to !== undefined) {
    where.entryDate = {};
    if (req.query.from !== undefined) where.entryDate.gte = new Date(`${req.query.from}T00:00:00.000Z`);
    if (req.query.to !== undefined) where.entryDate.lte = new Date(`${req.query.to}T00:00:00.000Z`);
  }

  const rows = await prisma.wellnessEntry.findMany({
    where,
    orderBy: { entryDate: "desc" },
  });

  return res.status(200).json({ data: rows.map(serializeEntry) });
}

module.exports = { upsertEntry, listMyEntries, serializeEntry };
