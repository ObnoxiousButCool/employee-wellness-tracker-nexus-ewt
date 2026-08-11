const express = require("express");
const authenticate = require("../middleware/authenticate");
const asyncHandler = require("../utils/asyncHandler");
const entriesController = require("../controllers/wellnessEntriesController");

const router = express.Router();

// Every /api/wellness/* route requires an authenticated user (any role
// logs their own wellness entries).
router.use(authenticate);

router.get("/entries/me", asyncHandler(entriesController.listMyEntries));
router.post("/entries", asyncHandler(entriesController.upsertEntry));

module.exports = router;
