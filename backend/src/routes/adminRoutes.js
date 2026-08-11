const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const asyncHandler = require("../utils/asyncHandler");
const usersController = require("../controllers/adminUsersController");
const departmentsController = require("../controllers/adminDepartmentsController");
const rolesController = require("../controllers/adminRolesController");

const router = express.Router();

// Every /api/admin/* route requires an authenticated ADMIN.
router.use(authenticate, requireRole(["ADMIN"]));

router.get("/roles", asyncHandler(rolesController.listRoles));

router.get("/users", asyncHandler(usersController.listUsers));
router.post("/users", asyncHandler(usersController.createUser));
router.put("/users/:id", asyncHandler(usersController.updateUser));
router.patch("/users/:id/status", asyncHandler(usersController.updateUserStatus));

router.get("/departments", asyncHandler(departmentsController.listDepartments));
router.post("/departments", asyncHandler(departmentsController.createDepartment));
router.put("/departments/:id", asyncHandler(departmentsController.updateDepartment));

module.exports = router;
