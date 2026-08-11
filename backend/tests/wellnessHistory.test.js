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

function entry(overrides) {
  return {
    workHours: 8,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const ENTRIES = [
  entry({
    id: 1,
    userId: 2,
    entryDate: new Date(2026, 0, 1),
    stressLevel: 5,
    sleepHours: 7,
    mood: "GOOD",
    energyLevel: "HIGH",
  }),
  entry({
    id: 2,
    userId: 2,
    entryDate: new Date(2026, 0, 2),
    stressLevel: 8,
    sleepHours: 5,
    mood: "LOW",
    energyLevel: "LOW",
  }),
  entry({
    id: 3,
    userId: 3,
    entryDate: new Date(2026, 0, 2),
    stressLevel: 3,
    sleepHours: 8,
    mood: "GREAT",
    energyLevel: "VERY_HIGH",
  }),
];

function buildApp() {
  return buildTestApp({ departments: DEPARTMENTS, users: USERS, wellnessEntries: ENTRIES });
}

test("GET /api/wellness/history rejects unauthenticated requests with 401", async () => {
  const { app } = buildApp();
  const res = await request(app).get("/api/wellness/history");
  assert.equal(res.status, 401);
});

test("GET /api/wellness/history rejects EMPLOYEE role with 403", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 2, role: "EMPLOYEE", departmentId: 1 });
  const res = await request(app).get("/api/wellness/history").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test("GET /api/wellness/history as ADMIN returns all departments' entries, newest first by default", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app).get("/api/wellness/history").set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 3);
  assert.deepEqual(
    res.body.data.map((r) => r.entryDate),
    ["2026-01-02", "2026-01-02", "2026-01-01"]
  );
  assert.equal(res.body.pagination.total, 3);
});

test("GET /api/wellness/history as MANAGER only ever returns their own department's entries, even if a different department is requested", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 1, role: "MANAGER", departmentId: 1 });
  const res = await request(app)
    .get("/api/wellness/history?department=2")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
  assert.ok(res.body.data.every((r) => r.userId === 2));
});

test("GET /api/wellness/history as MANAGER requesting an out-of-department userId returns empty, not another department's data", async () => {
  const { app } = buildApp();
  const token = signToken({ userId: 1, role: "MANAGER", departmentId: 1 });
  const res = await request(app)
    .get("/api/wellness/history?userId=3")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 0);
});

test("GET /api/wellness/history filters by mood", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/wellness/history?mood=GREAT")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].userId, 3);
});

test("GET /api/wellness/history supports sortBy/sortOrder column toggle", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/wellness/history?sortBy=stressLevel&sortOrder=asc")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.data.map((r) => r.stressLevel),
    [3, 5, 8]
  );
});

test("GET /api/wellness/history returns 400 for a malformed userId instead of coercing it", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/wellness/history?userId=12abc")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 400);
  assert.ok(res.body.errors.userId);
});

test("GET /api/wellness/history returns 400 for a malformed department instead of coercing it", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/wellness/history?department=2abc")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 400);
  assert.ok(res.body.errors.department);
});

test("GET /api/wellness/history returns 400 for an invalid sortBy", async () => {
  const { app, adminToken } = buildApp();
  const res = await request(app)
    .get("/api/wellness/history?sortBy=nope")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 400);
  assert.ok(res.body.errors.sortBy);
});
