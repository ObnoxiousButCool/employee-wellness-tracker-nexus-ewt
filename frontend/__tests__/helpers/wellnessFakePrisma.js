/**
 * In-memory stand-in for the one Prisma model the wellness routes touch
 * (`wellnessEntry`). Deliberately independent of `backend/tests/helpers/
 * fakePrisma.js` — that file is the backend layer's own test helper, and
 * importing it from a frontend test coupled this suite to a file the
 * frontend does not own and could break out from under it. Matches real
 * Prisma's `findMany`(where `userId`/`entryDate.gte`/`entryDate.lte`,
 * `orderBy.entryDate`)/`upsert`(composite `userId_entryDate` key) semantics
 * for exactly the shapes `wellnessEntriesController.js` sends.
 */

function matchesEntryDate(row, condition) {
  if (!condition) return true;
  const value = row.entryDate.getTime();
  if (condition.gte !== undefined && value < condition.gte.getTime()) return false;
  if (condition.lte !== undefined && value > condition.lte.getTime()) return false;
  return true;
}

export function createWellnessFakePrisma({ wellnessEntries = [] } = {}) {
  const state = wellnessEntries.map((row) => ({ ...row }));
  let nextId = state.reduce((max, row) => Math.max(max, row.id), 0) + 1;

  return {
    wellnessEntry: {
      async findMany({ where = {}, orderBy } = {}) {
        let rows = state.filter(
          (row) => (where.userId === undefined || row.userId === where.userId) && matchesEntryDate(row, where.entryDate)
        );
        if (orderBy?.entryDate === "desc") rows = [...rows].sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime());
        else if (orderBy?.entryDate === "asc") rows = [...rows].sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
        return rows.map((row) => ({ ...row }));
      },
      async upsert({ where, create, update }) {
        const { userId, entryDate } = where.userId_entryDate;
        const row = state.find((r) => r.userId === userId && r.entryDate.getTime() === entryDate.getTime());
        const now = new Date();
        if (row) {
          Object.assign(row, update, { updatedAt: now });
          return { ...row };
        }
        const created = { id: nextId++, createdAt: now, updatedAt: now, ...create };
        state.push(created);
        return { ...created };
      },
    },
    _state: state,
  };
}
