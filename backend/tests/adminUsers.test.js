const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { buildTestApp, signToken } = require("./helpers/testApp");

const SEED_DEPARTMENTS = [
  { id: 1, name: "Engineering", isActive: true },
  { id: 2, name: "Sales", isActive: true },
];

function seedUsers() {
  return [
    {
      id: 1,
      name: "Ada Admin",
      email: "ada@example.com",
      passwordHash: "hash",
      roleId: 1,
      departmentId: 1,
      isActive: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    {
      id: 2,
      name: "Bob Builder",
      email: "bob@example.com",
      passwordHash: "hash",
      roleId: 3,
      departmentId: 2,
      isActive: false,
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
    },
  ];
}

test("GET /api/admin/users rejects unauthenticated requests with 401", async () => {
  const { app } = buildTestApp({ departments: SEED_DEPARTMENTS, users: seedUsers() });
  const res = await request(app).get("/api/admin/users");
  assert.equal(res.status, 401);
});

test("GET /api/admin/users rejects non-admin roles with 403", async () => {
  const { app } = buildTestApp({ departments: SEED_DEPARTMENTS, users: seedUsers() });
  const token = signToken({ role: "EMPLOYEE" });
  const res = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test("GET /api/admin/users returns paginated, joined results for an admin", async () => {
  const { app, adminToken } = buildTestApp({ departments: SEED_DEPARTMENTS, users: seedUsers() });
  const res = await request(app)
    .get("/api/admin/users?page=1&pageSize=1")
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.deepEqual(res.body.pagination, { page: 1, pageSize: 1, total: 2, totalPages: 2 });
  assert.equal(res.body.data[0].role, "ADMIN");
  assert.equal(res.body.data[0].department, "Engineering");
  assert.equal(res.body.data[0].passwordHash, undefined);
});

test("GET /api/admin/users filters by search, department, and status", async () => {
  const { app, adminToken } = buildTestApp({ departments: SEED_DEPARTMENTS, users: seedUsers() });

  const bySearch = await request(app)
    .get("/api/admin/users?search=bob")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(bySearch.body.data.length, 1);
  assert.equal(bySearch.body.data[0].email, "bob@example.com");

  const byDept = await request(app)
    .get("/api/admin/users?department=2")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(byDept.body.data.length, 1);
  assert.equal(byDept.body.data[0].name, "Bob Builder");

  const byStatus = await request(app)
    .get("/api/admin/users?status=inactive")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(byStatus.body.data.length, 1);
  assert.equal(byStatus.body.data[0].isActive, false);
});

test("POST /api/admin/users creates a user with a hashed password", async () => {
  const { app, adminToken, prisma } = buildTestApp({ departments: SEED_DEPARTMENTS, users: [] });
  const res = await request(app)
    .post("/api/admin/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "New Hire", email: "new@example.com", password: "supersecret", roleId: 3, departmentId: 1 });

  assert.equal(res.status, 201);
  assert.equal(res.body.email, "new@example.com");
  assert.equal(res.body.role, "EMPLOYEE");
  const stored = prisma._state.users.find((u) => u.email === "new@example.com");
  assert.notEqual(stored.passwordHash, "supersecret");
});

test("POST /api/admin/users returns 409 on duplicate email", async () => {
  const { app, adminToken } = buildTestApp({ departments: SEED_DEPARTMENTS, users: seedUsers() });
  const res = await request(app)
    .post("/api/admin/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Dup", email: "ada@example.com", password: "supersecret", roleId: 3 });

  assert.equal(res.status, 409);
  assert.match(res.body.error, /already in use/i);
});

test("POST /api/admin/users returns 400 for missing required fields", async () => {
  const { app, adminToken } = buildTestApp({ departments: SEED_DEPARTMENTS, users: [] });
  const res = await request(app)
    .post("/api/admin/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email: "bad" });

  assert.equal(res.status, 400);
});

test("PUT /api/admin/users/:id updates fields and rejects email conflicts", async () => {
  const { app, adminToken } = buildTestApp({ departments: SEED_DEPARTMENTS, users: seedUsers() });

  const ok = await request(app)
    .put("/api/admin/users/2")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Bob B. Builder" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.name, "Bob B. Builder");

  const conflict = await request(app)
    .put("/api/admin/users/2")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email: "ada@example.com" });
  assert.equal(conflict.status, 409);
});

test("PUT /api/admin/users/:id returns 404 for a missing user", async () => {
  const { app, adminToken } = buildTestApp({ departments: SEED_DEPARTMENTS, users: seedUsers() });
  const res = await request(app)
    .put("/api/admin/users/999")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Nobody" });
  assert.equal(res.status, 404);
});

test("PATCH /api/admin/users/:id/status activates and deactivates without deleting", async () => {
  const { app, adminToken, prisma } = buildTestApp({ departments: SEED_DEPARTMENTS, users: seedUsers() });

  const res = await request(app)
    .patch("/api/admin/users/1/status")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ isActive: false });

  assert.equal(res.status, 200);
  assert.equal(res.body.isActive, false);
  assert.equal(prisma._state.users.length, 2);
});
