/**
 * In-memory stand-in for the Prisma models the wellness routes touch
 * (`wellnessEntry`, plus `user` for the S4 manager/admin reporting
 * surface). Deliberately independent of `backend/tests/helpers/
 * fakePrisma.js` — that file is the backend layer's own test helper, and
 * importing it from a frontend test coupled prior suites to a file the
 * frontend does not own and could break out from under it. Matches real
 * Prisma's `findMany`/`findUnique`/`count`/`upsert` semantics for exactly
 * the shapes `wellnessEntriesController.js`, `wellnessHistoryController.js`,
 * `employeeProfileController.js`, and `enforceEmployeeDepartmentScope.js`
 * send.
 */

function matchesEntryDate(row, condition) {
  if (!condition) return true;
  const value = row.entryDate.getTime();
  if (condition.gte !== undefined && value < condition.gte.getTime()) return false;
  if (condition.lte !== undefined && value > condition.lte.getTime()) return false;
  return true;
}

function matchesUserId(row, condition) {
  if (condition === undefined) return true;
  if (typeof condition === "object" && condition !== null && "in" in condition) {
    return condition.in.includes(row.userId);
  }
  return row.userId === condition;
}

function matchesMood(row, condition) {
  if (condition === undefined) return true;
  return row.mood === condition;
}

function filterEntries(state, where = {}) {
  return state.filter(
    (row) => matchesUserId(row, where.userId) && matchesMood(row, where.mood) && matchesEntryDate(row, where.entryDate)
  );
}

function sortEntries(rows, orderBy) {
  if (!orderBy) return rows;
  const [field] = Object.keys(orderBy);
  const direction = orderBy[field];
  const sorted = [...rows].sort((a, b) => {
    const av = a[field] instanceof Date ? a[field].getTime() : Number(a[field]);
    const bv = b[field] instanceof Date ? b[field].getTime() : Number(b[field]);
    return av - bv;
  });
  return direction === "desc" ? sorted.reverse() : sorted;
}

export function createWellnessFakePrisma({ wellnessEntries = [], users = [] } = {}) {
  const state = wellnessEntries.map((row) => ({ ...row }));
  const userState = users.map((row) => ({ ...row }));
  let nextId = state.reduce((max, row) => Math.max(max, row.id), 0) + 1;

  return {
    wellnessEntry: {
      async findMany({ where = {}, orderBy, skip, take } = {}) {
        let rows = sortEntries(filterEntries(state, where), orderBy);
        if (skip !== undefined) rows = rows.slice(skip);
        if (take !== undefined) rows = rows.slice(0, take);
        return rows.map((row) => ({ ...row }));
      },
      async count({ where = {} } = {}) {
        return filterEntries(state, where).length;
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
    user: {
      async findMany({ where = {} } = {}) {
        let rows = userState;
        if (where.departmentId !== undefined) rows = rows.filter((u) => u.departmentId === where.departmentId);
        if (where.id?.in) rows = rows.filter((u) => where.id.in.includes(u.id));
        return rows.map((u) => ({ ...u }));
      },
      async findUnique({ where }) {
        const row = userState.find((u) => u.id === where.id);
        return row ? { ...row } : null;
      },
    },
    _state: state,
  };
}
