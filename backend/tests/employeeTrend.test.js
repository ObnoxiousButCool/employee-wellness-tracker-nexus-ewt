const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { buildTestApp, signToken } = require("./helpers/testApp");
const { DEPARTMENTS, USERS, entry, buildApp } = require("./helpers/employeeProfileFixtures");

test("GET /api/wellness/employees/:id/trend returns 400 for a malformed employee id instead of coercing it", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/wellness/employees/12abc/trend?metric=stress&range=30d")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 400);
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

test("GET /api/wellness/employees/:id/trend 30d window includes the boundary day regardless of the time-of-day the request is made", async () => {
  const boundaryDate = new Date();
  boundaryDate.setHours(0, 0, 0, 0);
  boundaryDate.setDate(boundaryDate.getDate() - 29);
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
    .get("/api/wellness/employees/2/trend?metric=stress&range=30d")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
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
