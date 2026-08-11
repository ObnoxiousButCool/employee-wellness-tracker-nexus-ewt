const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const enforceEmployeeDepartmentScope = require("../middleware/enforceEmployeeDepartmentScope");
const asyncHandler = require("../utils/asyncHandler");
const entriesController = require("../controllers/wellnessEntriesController");
const historyController = require("../controllers/wellnessHistoryController");
const employeeProfileController = require("../controllers/employeeProfileController");

const router = express.Router();

// Every /api/wellness/* route requires an authenticated user (any role
// logs their own wellness entries).
router.use(authenticate);

router.get("/entries/me", asyncHandler(entriesController.listMyEntries));
router.post("/entries", asyncHandler(entriesController.upsertEntry));

// Manager/Admin-only reporting surface; department scoping is enforced in
// the handlers themselves (see wellnessHistoryController and
// enforceEmployeeDepartmentScope), not just hidden in the frontend nav.
const requireManagerOrAdmin = requireRole(["ADMIN", "MANAGER"]);

router.get("/history", requireManagerOrAdmin, asyncHandler(historyController.getHistory));
router.get(
  "/employees/:id/profile",
  requireManagerOrAdmin,
  enforceEmployeeDepartmentScope,
  asyncHandler(employeeProfileController.getProfile)
);
router.get(
  "/employees/:id/trend",
  requireManagerOrAdmin,
  enforceEmployeeDepartmentScope,
  asyncHandler(employeeProfileController.getTrend)
);

module.exports = router;
