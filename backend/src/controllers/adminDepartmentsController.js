const {
  validateCreateDepartment,
  validateUpdateDepartment,
} = require("../utils/validators");

function serializeDepartment(row) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    activeUserCount: row.activeUserCount,
  };
}

/** GET /api/admin/departments?status= */
async function listDepartments(req, res) {
  const prisma = req.app.locals.prisma;
  const { status } = req.query;
  const where = {};
  if (status === "active") where.isActive = true;
  else if (status === "inactive") where.isActive = false;

  const rows = await prisma.department.findMany({ where, orderBy: { id: "asc" } });
  const withCounts = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      activeUserCount: await prisma.user.count({ where: { departmentId: row.id, isActive: true } }),
    })),
  );

  return res.status(200).json({ data: withCounts.map(serializeDepartment) });
}

/** POST /api/admin/departments */
async function createDepartment(req, res) {
  const errors = validateCreateDepartment(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const prisma = req.app.locals.prisma;
  try {
    const created = await prisma.department.create({
      data: {
        name: req.body.name.trim(),
        isActive: req.body.isActive ?? true,
      },
    });
    return res.status(201).json(serializeDepartment({ ...created, activeUserCount: 0 }));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Department name is already in use" });
    }
    throw err;
  }
}

/**
 * PUT /api/admin/departments/:id
 * Handles both renames and the active/inactive soft-status toggle in one
 * endpoint. Never touches the users table, so deactivating a department
 * never cascade-deactivates its users; activeUserCount in the response
 * lets the caller warn the admin about affected users.
 */
async function updateDepartment(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid department id" });
  }
  const errors = validateUpdateDepartment(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const prisma = req.app.locals.prisma;
  const data = {};
  if (req.body.name !== undefined) data.name = req.body.name.trim();
  if (req.body.isActive !== undefined) data.isActive = req.body.isActive;

  try {
    const updated = await prisma.department.update({ where: { id }, data });
    const activeUserCount = await prisma.user.count({ where: { departmentId: id, isActive: true } });
    return res.status(200).json(serializeDepartment({ ...updated, activeUserCount }));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Department name is already in use" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Department not found" });
    }
    throw err;
  }
}

module.exports = { listDepartments, createDepartment, updateDepartment, serializeDepartment };
