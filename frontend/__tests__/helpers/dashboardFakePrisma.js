/**
 * In-memory stand-in for the Prisma models `dashboardController.getSummary`
 * (S5) touches: `department`, `user` (with a nested `role.name`, unlike
 * `wellnessFakePrisma.js`'s flatter `user` model, since the dashboard
 * controller filters on `role.name === "EMPLOYEE"`), and `wellnessEntry`.
 * Frontend-owned, independent of `backend/tests/helpers/fakePrisma.js` for
 * the same reason `wellnessFakePrisma.js` is (S4 fix iteration 2).
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

export function createDashboardFakePrisma({ departments = [], users = [], wellnessEntries = [] } = {}) {
  const departmentState = departments.map((d) => ({ ...d }));
  const userState = users.map((u) => ({ ...u, role: u.role ? { ...u.role } : null }));
  const entryState = wellnessEntries.map((e) => ({ ...e }));

  return {
    department: {
      async findUnique({ where }) {
        const row = departmentState.find((d) => d.id === where.id);
        return row ? { ...row } : null;
      },
      async findMany({ where = {} } = {}) {
        let rows = departmentState;
        if (where.isActive !== undefined) rows = rows.filter((d) => d.isActive === where.isActive);
        return rows.map((d) => ({ ...d }));
      },
    },
    user: {
      async findMany({ where = {} } = {}) {
        let rows = userState;
        if (where.isActive !== undefined) rows = rows.filter((u) => u.isActive === where.isActive);
        if (where.departmentId !== undefined) rows = rows.filter((u) => u.departmentId === where.departmentId);
        return rows.map((u) => ({ ...u, role: u.role ? { ...u.role } : null }));
      },
    },
    wellnessEntry: {
      async findMany({ where = {} } = {}) {
        const rows = entryState.filter(
          (row) => matchesUserId(row, where.userId) && matchesEntryDate(row, where.entryDate)
        );
        return rows.map((row) => ({ ...row }));
      },
    },
  };
}
