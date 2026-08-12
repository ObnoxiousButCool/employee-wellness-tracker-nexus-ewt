const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { buildTestApp, signToken } = require("./helpers/testApp");
const { DEPARTMENTS, makeUser, dayOffset, entry, buildApp } = require("./helpers/dashboardFixtures");

function close(actual, expected, tolerance = 0.05) {
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${actual} to be close to ${expected}`);
}

test("GET /api/dashboard/summary rejects unauthenticated requests with 401", async () => {
  const { app } = buildApp();
  const res = await request(app).get("/api/dashboard/summary");
  assert.equal(res.status, 401);
});

test("GET /api/dashboard/summary rejects EMPLOYEE role with 403", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 2, role: "EMPLOYEE", departmentId: 1 });
  const res = await request(app).get("/api/dashboard/summary").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test("GET /api/dashboard/summary as ADMIN with scope=department and no departmentId returns 400", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/dashboard/summary?scope=department")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.departmentId);
});

test("GET /api/dashboard/summary as ADMIN with an unknown departmentId returns 404", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/dashboard/summary?scope=department&departmentId=999")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test("GET /api/dashboard/summary as ADMIN with scope=org returns the full KPI payload across all departments", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app).get("/api/dashboard/summary?scope=org").set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.scope, "org");
  assert.equal(res.body.departmentId, null);

  const kpiByName = Object.fromEntries(res.body.kpiCards.map((c) => [c.name, c.value]));
  assert.equal(kpiByName["Total Active Employees"], 3);
  assert.equal(kpiByName["Submissions Today"], 2);
  assert.equal(kpiByName["Employees Requiring Attention"], 2);
  close(kpiByName["Average Wellness Score"], 54.5);

  const distByCategory = Object.fromEntries(res.body.wellnessStatusDistribution.map((d) => [d.category, d.count]));
  assert.deepEqual(distByCategory, { THRIVING: 1, STABLE: 0, AT_RISK: 2, CRITICAL: 0 });

  const deptScores = Object.fromEntries(res.body.departmentWellnessScores.map((d) => [d.name, d]));
  assert.equal(deptScores.Engineering.employeeCount, 2);
  assert.equal(deptScores.Sales.employeeCount, 1);
  close(deptScores.Sales.score, 81);

  assert.equal(res.body.weeklyWellnessTrends.length, 7);
  const trend = res.body.weeklyWellnessTrends;
  assert.equal(trend[3].score, null);
  close(trend[4].score, 50);
  close(trend[5].score, 57);
  close(trend[6].score, 55.5);

  assert.equal(res.body.topHighStressEmployees.length, 3);
  assert.deepEqual(
    res.body.topHighStressEmployees.map((e) => e.employeeId),
    [4, 2, 3]
  );
  assert.equal(res.body.topHighStressEmployees[0].name, "Dave Engineer");
});

test("GET /api/dashboard/summary as ADMIN with scope=department returns that department's KPI payload", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/dashboard/summary?scope=department&departmentId=1")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.scope, "department");
  assert.equal(res.body.departmentId, 1);

  const kpiByName = Object.fromEntries(res.body.kpiCards.map((c) => [c.name, c.value]));
  assert.equal(kpiByName["Total Active Employees"], 2);

  assert.equal(res.body.departmentWellnessScores.length, 1);
  assert.equal(res.body.departmentWellnessScores[0].name, "Engineering");
  assert.equal(res.body.departmentWellnessScores[0].employeeCount, 2);

  const ids = res.body.topHighStressEmployees.map((e) => e.employeeId);
  assert.ok(!ids.includes(3), "Sales employee must never appear in an ADMIN's department-scoped summary");
});

test("GET /api/dashboard/summary as MANAGER ignores a malformed client-supplied scope/departmentId instead of 400ing", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 1, role: "MANAGER", departmentId: 1 });
  const res = await request(app)
    .get("/api/dashboard/summary?scope=not-a-real-scope&departmentId=not-a-number")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.scope, "department");
  assert.equal(res.body.departmentId, 1);
});

test("GET /api/dashboard/summary as MANAGER always scopes to their own department, ignoring a requested scope/departmentId", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 1, role: "MANAGER", departmentId: 1 });
  const res = await request(app)
    .get("/api/dashboard/summary?scope=org&departmentId=2")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.scope, "department");
  assert.equal(res.body.departmentId, 1);

  const kpiByName = Object.fromEntries(res.body.kpiCards.map((c) => [c.name, c.value]));
  assert.equal(kpiByName["Total Active Employees"], 2);

  assert.equal(res.body.departmentWellnessScores.length, 1);
  assert.equal(res.body.departmentWellnessScores[0].name, "Engineering");

  const ids = res.body.topHighStressEmployees.map((e) => e.employeeId);
  assert.ok(!ids.includes(3), "Sales employee must never appear in a Manager's department-scoped summary");
});

test("GET /api/dashboard/summary as MANAGER with no assigned department returns a zeroed summary instead of erroring", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 1, role: "MANAGER", departmentId: null });
  const res = await request(app).get("/api/dashboard/summary").set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.departmentId, null);
  const kpiByName = Object.fromEntries(res.body.kpiCards.map((c) => [c.name, c.value]));
  assert.equal(kpiByName["Total Active Employees"], 0);
  assert.equal(kpiByName["Average Wellness Score"], null);
  assert.deepEqual(res.body.departmentWellnessScores, []);
  assert.deepEqual(res.body.topHighStressEmployees, []);
});

test("GET /api/dashboard/summary top-5 high-stress ranking breaks a tied average stressLevel by the most recent submission", async () => {
  const users = [
    makeUser({ id: 10, name: "Older Submitter", email: "older@x.com", roleId: 3, departmentId: 1 }),
    makeUser({ id: 11, name: "Newer Submitter", email: "newer@x.com", roleId: 3, departmentId: 1 }),
  ];
  const entries = [
    entry({ id: 100, userId: 10, entryDate: dayOffset(3), stressLevel: 8, sleepHours: 6, mood: "LOW", energyLevel: "LOW" }),
    entry({ id: 101, userId: 11, entryDate: dayOffset(0), stressLevel: 8, sleepHours: 6, mood: "LOW", energyLevel: "LOW" }),
  ];
  const { app, adminToken } = buildTestApp({ departments: DEPARTMENTS, users, wellnessEntries: entries });

  const res = await request(app).get("/api/dashboard/summary?scope=org").set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.topHighStressEmployees.map((e) => e.employeeId),
    [11, 10]
  );
});
