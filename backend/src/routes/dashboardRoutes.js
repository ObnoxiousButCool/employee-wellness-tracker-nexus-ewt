const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const asyncHandler = require("../utils/asyncHandler");
const dashboardController = require("../controllers/dashboardController");

const router = express.Router();

// ADMIN/MANAGER only; department scoping is enforced in the controller
// itself (a MANAGER's scope is always forced to their own department),
// not just hidden in the frontend nav -- same pattern as wellnessRoutes.js.
router.use(authenticate, requireRole(["ADMIN", "MANAGER"]));

router.get("/summary", asyncHandler(dashboardController.getSummary));

module.exports = router;
