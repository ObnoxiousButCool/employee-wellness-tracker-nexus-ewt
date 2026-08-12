const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { buildTestApp, signToken } = require("./helpers/testApp");
const { calculateWellnessScore } = require("../src/utils/wellnessScoring");

const DEPARTMENTS = [
  { id: 1, name: "Engineering", isActive: true },
  { id: 2, name: "Sales", isActive: true },
  { id: 3, name: "Support", isActive: true },
];

const now = new Date();
function makeUser(overrides) {
  return { passwordHash: "x", isActive: true, createdAt: now, updatedAt: now, ...overrides };
}

// roleId 1 = ADMIN, 2 = MANAGER, 3 = EMPLOYEE (see helpers/testApp.js SEED_ROLES).
const USERS = [
  makeUser({ id: 1, name: "Mia Manager", email: "mia@x.com", roleId: 2, departmentId: 1 }),
  makeUser({ id: 2, name: "Bob Engineer", email: "bob@x.com", roleId: 3, departmentId: 1 }),
  makeUser({ id: 3, name: "Carol Sales", email: "carol@x.com", roleId: 3, departmentId: 2 }),
  makeUser({ id: 4, name: "Dave Engineer (no entries)", email: "dave@x.com", roleId: 3, departmentId: 1 }),
  makeUser({ id: 5, name: "Eve Support (no entries)", email: "eve@x.com", roleId: 3, departmentId: 3 }),
];

function entry(overrides) {
  return { workHours: 8, createdAt: now, updatedAt: now, ...overrides };
}

const ENTRIES = [
  // Bob: an older entry, then a newer one that must win as "latest".
  entry({ id: 1, userId: 2, entryDate: new Date(2026, 0, 1), stressLevel: 8, sleepHours: 4, mood: "LOW", energyLevel: "LOW" }),
  entry({ id: 2, userId: 2, entryDate: new Date(2026, 0, 5), stressLevel: 2, sleepHours: 8, mood: "GREAT", energyLevel: "VERY_HIGH" }),
  entry({ id: 3, userId: 3, entryDate: new Date(2026, 0, 3), stressLevel: 5, sleepHours: 6, mood: "NEUTRAL", energyLevel: "MEDIUM" }),
];

function buildApp() {
  return buildTestApp({ departments: DEPARTMENTS, users: USERS, wellnessEntries: ENTRIES });
}

test("GET /api/wellness/scores rejects unauthenticated requests with 401", async () => {
  const { app } = buildApp();
  const res = await request(app).get("/api/wellness/scores");
  assert.equal(res.status, 401);
});

test("GET /api/wellness/scores rejects EMPLOYEE role with 403", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 2, role: "EMPLOYEE", departmentId: 1 });
  const res = await request(app).get("/api/wellness/scores").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test("GET /api/wellness/scores as ADMIN returns each employee's latest score and category, omitting employees with no entries", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app).get("/api/wellness/scores").set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  const byEmployee = Object.fromEntries(res.body.data.map((r) => [r.employeeId, r]));

  assert.equal(byEmployee[2].score, calculateWellnessScore(2, 8, "VERY_HIGH"));
  assert.equal(byEmployee[2].classificationCategory, "Thriving");
  assert.equal(byEmployee[3].score, calculateWellnessScore(5, 6, "MEDIUM"));
  assert.equal(byEmployee[4], undefined);
});

test("GET /api/wellness/scores as ADMIN filters by ?department=", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app).get("/api/wellness/scores?department=2").set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.map((r) => r.employeeId), [3]);
});

test("GET /api/wellness/scores as ADMIN with a malformed department returns 400", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app).get("/api/wellness/scores?department=abc").set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.department);
});

test("GET /api/wellness/scores as MANAGER ignores a client-supplied department and is scoped to their own", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 1, role: "MANAGER", departmentId: 1 });
  const res = await request(app).get("/api/wellness/scores?department=2").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.map((r) => r.employeeId).sort(), [2]);
});

test("GET /api/departments/:departmentId/wellness/score returns the mean of latest scores", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app).get("/api/departments/1/wellness/score").set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { departmentId: 1, score: calculateWellnessScore(2, 8, "VERY_HIGH") });
});

test("GET /api/departments/:departmentId/wellness/score returns null when no employee in it has entries", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app).get("/api/departments/3/wellness/score").set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { departmentId: 3, score: null });
});

test("GET /api/departments/:departmentId/wellness/score returns 404 for an unknown department", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app).get("/api/departments/999/wellness/score").set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test("GET /api/departments/:departmentId/wellness/score returns 403 for a MANAGER requesting another department", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 1, role: "MANAGER", departmentId: 1 });
  const res = await request(app).get("/api/departments/2/wellness/score").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test("GET /api/departments/:departmentId/wellness/score allows a MANAGER to request their own department", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 1, role: "MANAGER", departmentId: 2 });
  const res = await request(app).get("/api/departments/2/wellness/score").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.departmentId, 2);
});
