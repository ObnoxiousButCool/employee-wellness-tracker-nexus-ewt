/**
 * In-memory stand-in for the subset of the Prisma Client API the admin
 * controllers use. No real Postgres is available in this environment, so
 * tests drive the real Express app + validation + serialization code
 * against this fake instead of mocking the controllers themselves. Error
 * shapes (P2002 unique violation, P2003 FK violation, P2025 not found)
 * mirror real Prisma so the controller code under test is identical to
 * what runs against a live database.
 */

function matchesWhere(row, where, tables) {
  if (!where || Object.keys(where).length === 0) return true;
  if (where.AND) return where.AND.every((clause) => matchesWhere(row, clause, tables));
  if (where.OR) return where.OR.some((clause) => matchesWhere(row, clause, tables));

  return Object.entries(where).every(([field, condition]) => {
    const value = row[field];
    if (condition && typeof condition === "object" && "contains" in condition) {
      const haystack = condition.mode === "insensitive" ? String(value).toLowerCase() : String(value);
      const needle = condition.mode === "insensitive" ? condition.contains.toLowerCase() : condition.contains;
      return haystack.includes(needle);
    }
    if (condition && typeof condition === "object" && "in" in condition) {
      return condition.in.includes(value);
    }
    if (condition && typeof condition === "object" && ("gte" in condition || "lte" in condition)) {
      const numeric = value instanceof Date ? value.getTime() : value;
      if ("gte" in condition) {
        const bound = condition.gte instanceof Date ? condition.gte.getTime() : condition.gte;
        if (numeric < bound) return false;
      }
      if ("lte" in condition) {
        const bound = condition.lte instanceof Date ? condition.lte.getTime() : condition.lte;
        if (numeric > bound) return false;
      }
      return true;
    }
    return value === condition;
  });
}

/** Generic ascending comparator used by wellnessEntry.findMany's orderBy. */
function compareValues(a, b) {
  if (a instanceof Date || b instanceof Date) {
    const at = a instanceof Date ? a.getTime() : a;
    const bt = b instanceof Date ? b.getTime() : b;
    return at - bt;
  }
  const an = Number(a);
  const bn = Number(b);
  if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
  return String(a).localeCompare(String(b));
}

function createFakePrisma({ roles = [], departments = [], users = [], wellnessEntries = [] } = {}) {
  const state = {
    roles: roles.map((r) => ({ ...r })),
    departments: departments.map((d) => ({ ...d })),
    users: users.map((u) => ({ ...u })),
    wellnessEntries: wellnessEntries.map((w) => ({ ...w })),
  };
  let nextUserId = state.users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
  let nextDeptId = state.departments.reduce((max, d) => Math.max(max, d.id), 0) + 1;
  let nextEntryId = state.wellnessEntries.reduce((max, w) => Math.max(max, w.id), 0) + 1;

  function hydrateUser(row) {
    return {
      ...row,
      role: state.roles.find((r) => r.id === row.roleId) || null,
      department: state.departments.find((d) => d.id === row.departmentId) || null,
    };
  }

  return {
    user: {
      async findMany({ where = {}, skip = 0, take, orderBy } = {}) {
        let rows = state.users.filter((u) => matchesWhere(u, where));
        if (orderBy?.id === "asc") rows = [...rows].sort((a, b) => a.id - b.id);
        rows = rows.slice(skip, take !== undefined ? skip + take : undefined);
        return rows.map(hydrateUser);
      },
      async count({ where = {} } = {}) {
        return state.users.filter((u) => matchesWhere(u, where)).length;
      },
      async groupBy({ by, where = {}, _count } = {}) {
        const field = by[0];
        const rows = state.users.filter((u) => matchesWhere(u, where));
        const counts = new Map();
        for (const row of rows) {
          const key = row[field];
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        return [...counts.entries()].map(([key, count]) => ({
          [field]: key,
          _count: typeof _count === "object" ? Object.fromEntries(Object.keys(_count).map((k) => [k, count])) : count,
        }));
      },
      async findUnique({ where }) {
        const row = state.users.find((u) => (where.id !== undefined ? u.id === where.id : u.email === where.email));
        return row ? hydrateUser(row) : null;
      },
      async create({ data }) {
        if (state.users.some((u) => u.email === data.email)) {
          const err = new Error("Unique constraint failed on the fields: (`email`)");
          err.code = "P2002";
          throw err;
        }
        if (!state.roles.some((r) => r.id === data.roleId)) {
          const err = new Error("Foreign key constraint failed on the field: `roleId`");
          err.code = "P2003";
          throw err;
        }
        if (data.departmentId != null && !state.departments.some((d) => d.id === data.departmentId)) {
          const err = new Error("Foreign key constraint failed on the field: `departmentId`");
          err.code = "P2003";
          throw err;
        }
        const now = new Date();
        const row = {
          id: nextUserId++,
          isActive: true,
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        state.users.push(row);
        return hydrateUser(row);
      },
      async update({ where, data }) {
        const row = state.users.find((u) => u.id === where.id);
        if (!row) {
          const err = new Error("Record to update not found.");
          err.code = "P2025";
          throw err;
        }
        if (data.email !== undefined && state.users.some((u) => u.id !== row.id && u.email === data.email)) {
          const err = new Error("Unique constraint failed on the fields: (`email`)");
          err.code = "P2002";
          throw err;
        }
        if (data.roleId !== undefined && !state.roles.some((r) => r.id === data.roleId)) {
          const err = new Error("Foreign key constraint failed on the field: `roleId`");
          err.code = "P2003";
          throw err;
        }
        if (data.departmentId != null && !state.departments.some((d) => d.id === data.departmentId)) {
          const err = new Error("Foreign key constraint failed on the field: `departmentId`");
          err.code = "P2003";
          throw err;
        }
        Object.assign(row, data, { updatedAt: new Date() });
        return hydrateUser(row);
      },
    },
    department: {
      async findMany({ where = {}, orderBy } = {}) {
        let rows = state.departments.filter((d) => matchesWhere(d, where));
        if (orderBy?.id === "asc") rows = [...rows].sort((a, b) => a.id - b.id);
        return rows.map((d) => ({ ...d }));
      },
      async findUnique({ where }) {
        const row = state.departments.find((d) => (where.id !== undefined ? d.id === where.id : d.name === where.name));
        return row ? { ...row } : null;
      },
      async create({ data }) {
        if (state.departments.some((d) => d.name === data.name)) {
          const err = new Error("Unique constraint failed on the fields: (`name`)");
          err.code = "P2002";
          throw err;
        }
        const row = { id: nextDeptId++, isActive: true, ...data };
        state.departments.push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = state.departments.find((d) => d.id === where.id);
        if (!row) {
          const err = new Error("Record to update not found.");
          err.code = "P2025";
          throw err;
        }
        if (data.name !== undefined && state.departments.some((d) => d.id !== row.id && d.name === data.name)) {
          const err = new Error("Unique constraint failed on the fields: (`name`)");
          err.code = "P2002";
          throw err;
        }
        Object.assign(row, data);
        return { ...row };
      },
    },
    role: {
      async findMany({ orderBy } = {}) {
        let rows = state.roles.map((r) => ({ ...r }));
        if (orderBy?.id === "asc") rows = rows.sort((a, b) => a.id - b.id);
        return rows;
      },
    },
    wellnessEntry: {
      async findMany({ where = {}, orderBy, skip = 0, take } = {}) {
        let rows = state.wellnessEntries.filter((w) => matchesWhere(w, where));
        if (orderBy) {
          // Prisma accepts either a single orderBy object or an array of
          // them for a multi-field sort (first entry wins, later entries
          // break ties) -- support both so callers can add a deterministic
          // tiebreaker (e.g. `id`) alongside the primary sort column.
          const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
          rows = [...rows].sort((a, b) => {
            for (const clause of clauses) {
              const [field] = Object.keys(clause);
              const dir = clause[field];
              const cmp = compareValues(a[field], b[field]);
              if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
            }
            return 0;
          });
        }
        rows = rows.slice(skip, take !== undefined ? skip + take : undefined);
        return rows.map((row) => ({ ...row }));
      },
      async count({ where = {} } = {}) {
        return state.wellnessEntries.filter((w) => matchesWhere(w, where)).length;
      },
      async upsert({ where, create, update }) {
        const { userId, entryDate } = where.userId_entryDate;
        const row = state.wellnessEntries.find(
          (w) => w.userId === userId && w.entryDate.getTime() === entryDate.getTime()
        );
        const now = new Date();
        if (row) {
          Object.assign(row, update, { updatedAt: now });
          return { ...row };
        }
        const created = {
          id: nextEntryId++,
          createdAt: now,
          updatedAt: now,
          ...create,
        };
        state.wellnessEntries.push(created);
        return { ...created };
      },
    },
    _state: state,
  };
}

module.exports = { createFakePrisma };
