const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { buildTestApp, signToken } = require("./helpers/testApp");
const {
  DEPARTMENTS,
  DEFAULT_PROFILE_RANGE_DAYS,
  USERS,
  entry,
  buildApp,
} = require("./helpers/employeeProfileFixtures");

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

test("GET /api/wellness/employees/:id/profile returns 400 for a malformed employee id instead of coercing it", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/wellness/employees/12abc/profile")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 400);
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

test("GET /api/wellness/employees/:id/profile default 30-day window includes the boundary day regardless of the time-of-day the request is made", async () => {
  const boundaryDate = new Date();
  boundaryDate.setHours(0, 0, 0, 0);
  boundaryDate.setDate(boundaryDate.getDate() - (DEFAULT_PROFILE_RANGE_DAYS - 1));
  const boundaryEntry = entry({
    id: 99,
    userId: 2,
    entryDate: boundaryDate,
    stressLevel: 7,
    sleepHours: 6,
    mood: "NEUTRAL",
    energyLevel: "MEDIUM",
  });
  const { app, adminToken } = buildTestApp({
    departments: DEPARTMENTS,
    users: USERS,
    wellnessEntries: [boundaryEntry],
  });

  const res = await request(app)
    .get("/api/wellness/employees/2/profile")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.stats.entryCount, 1);
});
