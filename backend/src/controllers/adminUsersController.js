const bcrypt = require("bcrypt");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const {
  validateCreateUser,
  validateUpdateUser,
  validateStatusUpdate,
} = require("../utils/validators");

const BCRYPT_COST = 10;

function serializeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roleId: row.roleId,
    role: row.role ? row.role.name : null,
    departmentId: row.departmentId,
    department: row.department ? row.department.name : null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** GET /api/admin/users?search=&department=&status=&page=&pageSize= */
async function listUsers(req, res) {
  const prisma = req.app.locals.prisma;
  const { search, department, status } = req.query;
  const { page, pageSize, skip, take } = parsePagination(req.query);

  const conditions = [];
  if (typeof search === "string" && search.trim().length > 0) {
    const term = search.trim();
    conditions.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    });
  }
  const departmentId = Number.parseInt(department, 10);
  if (Number.isInteger(departmentId)) {
    conditions.push({ departmentId });
  }
  if (status === "active") conditions.push({ isActive: true });
  else if (status === "inactive") conditions.push({ isActive: false });

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { role: true, department: true },
      orderBy: { id: "asc" },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return res.status(200).json({
    data: rows.map(serializeUser),
    pagination: buildPaginationMeta(page, pageSize, total),
  });
}

/** POST /api/admin/users */
async function createUser(req, res) {
  const errors = validateCreateUser(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const prisma = req.app.locals.prisma;
  const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_COST);

  try {
    const created = await prisma.user.create({
      data: {
        name: req.body.name.trim(),
        email: req.body.email.trim().toLowerCase(),
        passwordHash,
        roleId: req.body.roleId,
        departmentId: req.body.departmentId ?? null,
      },
      include: { role: true, department: true },
    });
    return res.status(201).json(serializeUser(created));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Email is already in use" });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "roleId or departmentId does not reference an existing record" });
    }
    throw err;
  }
}

/** PUT /api/admin/users/:id */
async function updateUser(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  const errors = validateUpdateUser(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const prisma = req.app.locals.prisma;
  const data = {};
  if (req.body.name !== undefined) data.name = req.body.name.trim();
  if (req.body.email !== undefined) data.email = req.body.email.trim().toLowerCase();
  if (req.body.roleId !== undefined) data.roleId = req.body.roleId;
  if (req.body.departmentId !== undefined) data.departmentId = req.body.departmentId;

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      include: { role: true, department: true },
    });
    return res.status(200).json(serializeUser(updated));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Email is already in use" });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "roleId or departmentId does not reference an existing record" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    throw err;
  }
}

/** PATCH /api/admin/users/:id/status */
async function updateUserStatus(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  const errors = validateStatusUpdate(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join("; ") });
  }

  const prisma = req.app.locals.prisma;
  try {
    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: req.body.isActive },
      include: { role: true, department: true },
    });
    return res.status(200).json(serializeUser(updated));
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    throw err;
  }
}

module.exports = { listUsers, createUser, updateUser, updateUserStatus, serializeUser };
