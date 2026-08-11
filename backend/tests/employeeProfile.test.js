const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { buildTestApp, signToken } = require("./helpers/testApp");

const DEPARTMENTS = [
  { id: 1, name: "Engineering", isActive: true },
  { id: 2, name: "Sales", isActive: true },
];

const now = new Date();
function makeUser(overrides) {
  return { passwordHash: "x", isActive: true, createdAt: now, updatedAt: now, ...overrides };
}

const USERS = [
  makeUser({ id: 1, name: "Mia Manager", email: "mia@x.com", roleId: 2, departmentId: 1 }),
  makeUser({ id: 2, name: "Bob Engineer", email: "bob@x.com", roleId: 3, departmentId: 1 }),
  makeUser({ id: 3, name: "Carol Sales", email: "carol@x.com", roleId: 3, departmentId: 2 }),
];

function recentDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function entry(overrides) {
  return { workHours: 8, createdAt: now, updatedAt: now, ...overrides };
}

const ENTRIES = [
  entry({
    id: 1,
    userId: 2,
    entryDate: recentDate(1),
    stressLevel: 4,
    sleepHours: 6,
    mood: "GOOD",
    energyLevel: "HIGH",
  }),
  entry({
    id: 2,
    userId: 2,
    entryDate: recentDate(2),
    stressLevel: 6,
    sleepHours: 8,
    mood: "NEUTRAL",
    energyLevel: "MEDIUM",
  }),
];

function buildApp() {
  return buildTestApp({ departments: DEPARTMENTS, users: USERS, wellnessEntries: ENTRIES });
}

test("GET /api/wellness/employees/:id/profile rejects unauthenticated requests with 401", async () => {
  const { app } = buildApp();
  const res = await request(app).get("/api/wellness/employees/2/profile");
  assert.equal(res.status, 401);
});

test("GET /api/wellness/employees/:id/profile rejects EMPLOYEE role with 403", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 2, role: "EMPLOYEE", departmentId: 1 });
  const res = await request(app)
    .get("/api/wellness/employees/2/profile")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test("GET /api/wellness/employees/:id/profile as MANAGER for an employee outside their department returns 403", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 1, role: "MANAGER", departmentId: 1 });
  const res = await request(app)
    .get("/api/wellness/employees/3/profile")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test("GET /api/wellness/employees/:id/profile returns 404 for an unknown employee", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/wellness/employees/999/profile")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test("GET /api/wellness/employees/:id/profile as MANAGER for their own department's employee returns summary stats over the default 30-day window", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 1, role: "MANAGER", departmentId: 1 });
  const res = await request(app)
    .get("/api/wellness/employees/2/profile")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.id, 2);
  assert.equal(res.body.name, "Bob Engineer");
  assert.equal(res.body.stats.entryCount, 2);
  assert.equal(res.body.stats.avgStressLevel, 5);
  assert.equal(res.body.stats.avgSleepHours, 7);
  assert.equal(res.body.stats.avgEnergyScore, 3.5);
});

test("GET /api/wellness/employees/:id/trend rejects an invalid metric/range with 400", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/wellness/employees/2/trend?metric=nope&range=30d")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.metric);
});

test("GET /api/wellness/employees/:id/trend as MANAGER for an employee outside their department returns 403", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 1, role: "MANAGER", departmentId: 1 });
  const res = await request(app)
    .get("/api/wellness/employees/3/trend?metric=stress&range=30d")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test("GET /api/wellness/employees/:id/trend returns a pre-aggregated time series ordered oldest first", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/wellness/employees/2/trend?metric=stress&range=30d")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
  assert.deepEqual(
    res.body.data.map((p) => p.value),
    [6, 4]
  );
  assert.ok(res.body.data[0].date < res.body.data[1].date);
});
