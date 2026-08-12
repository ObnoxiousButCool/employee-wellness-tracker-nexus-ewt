const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const asyncHandler = require("../utils/asyncHandler");
const scoringController = require("../controllers/wellnessScoringController");

const router = express.Router();

// S6: GET /api/departments/:departmentId/wellness/score, ADMIN/MANAGER
// only; department-scoping is enforced in the controller itself (a MANAGER
// may only request their own department), not just hidden in the nav.
router.get(
  "/:departmentId/wellness/score",
  authenticate,
  requireRole(["ADMIN", "MANAGER"]),
  asyncHandler(scoringController.getDepartmentWellnessScore)
);

module.exports = router;
