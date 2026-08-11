const asyncHandler = require("../utils/asyncHandler");

/**
 * Must run after authenticate() + requireRole(["ADMIN", "MANAGER"]).
 * Loads the :id route param as the target employee and blocks a MANAGER
 * from reaching an employee outside their own department, enforced here in
 * the route handler (not just hidden in the nav). ADMIN bypasses the
 * department check. Attaches the loaded row to req.targetEmployee so
 * downstream controllers don't re-query it.
 */
const enforceEmployeeDepartmentScope = asyncHandler(async function (req, res, next) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid employee id" });
  }

  const prisma = req.app.locals.prisma;
  const employee = await prisma.user.findUnique({ where: { id } });
  if (!employee) {
    return res.status(404).json({ error: "Employee not found" });
  }

  if (req.user.role === "MANAGER" && employee.departmentId !== req.user.departmentId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  req.targetEmployee = employee;
  return next();
});

module.exports = enforceEmployeeDepartmentScope;
