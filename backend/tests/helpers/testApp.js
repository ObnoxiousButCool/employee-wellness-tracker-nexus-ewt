const TEST_JWT_SECRET = "test-secret-do-not-use-in-production";
process.env.JWT_SECRET = TEST_JWT_SECRET;

const jwt = require("jsonwebtoken");
const createApp = require("../../src/app");
const { createFakePrisma } = require("./fakePrisma");

const SEED_ROLES = [
  { id: 1, name: "ADMIN" },
  { id: 2, name: "MANAGER" },
  { id: 3, name: "EMPLOYEE" },
];

function signToken({ userId = 1, role = "ADMIN", departmentId = null } = {}) {
  return jwt.sign({ userId, role, departmentId }, TEST_JWT_SECRET, { expiresIn: "8h" });
}

/**
 * Builds a real Express app wired to the in-memory fake Prisma, plus a
 * ready-to-use signed admin token for Authorization headers.
 */
function buildTestApp(seed = {}) {
  const prisma = createFakePrisma({ roles: SEED_ROLES, ...seed });
  const app = createApp({ prisma });
  return { app, prisma, adminToken: signToken({ role: "ADMIN" }) };
}

module.exports = { buildTestApp, signToken, SEED_ROLES };
