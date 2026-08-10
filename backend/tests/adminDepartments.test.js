const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { buildTestApp } = require("./helpers/testApp");

const SEED_DEPARTMENTS = [
  { id: 1, name: "Engineering", isActive: true },
  { id: 2, name: "Sales", isActive: false },
];

const SEED_USERS = [
  {
    id: 1,
    name: "Ada Admin",
    email: "ada@example.com",
    passwordHash: "hash",
    roleId: 1,
    departmentId: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

test("GET /api/admin/departments requires an admin session", async () => {
  const { app } = buildTestApp({ departments: SEED_DEPARTMENTS, users: SEED_USERS });
  const res = await request(app).get("/api/admin/departments");
  assert.equal(res.status, 401);
});

test("GET /api/admin/departments lists departments with active user counts", async () => {
  const { app, adminToken } = buildTestApp({ departments: SEED_DEPARTMENTS, users: SEED_USERS });
  const res = await request(app).get("/api/admin/departments").set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
  const eng = res.body.data.find((d) => d.name === "Engineering");
  assert.equal(eng.activeUserCount, 1);
  const sales = res.body.data.find((d) => d.name === "Sales");
  assert.equal(sales.activeUserCount, 0);
});

test("POST /api/admin/departments creates a department and rejects duplicate names", async () => {
  const { app, adminToken } = buildTestApp({ departments: SEED_DEPARTMENTS, users: [] });

  const created = await request(app)
    .post("/api/admin/departments")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Marketing" });
  assert.equal(created.status, 201);
  assert.equal(created.body.isActive, true);
  assert.equal(created.body.activeUserCount, 0);

  const dup = await request(app)
    .post("/api/admin/departments")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Engineering" });
  assert.equal(dup.status, 409);
});

test("PUT /api/admin/departments/:id deactivates a department without touching its users", async () => {
  const { app, adminToken, prisma } = buildTestApp({ departments: SEED_DEPARTMENTS, users: SEED_USERS });

  const res = await request(app)
    .put("/api/admin/departments/1")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ isActive: false });

  assert.equal(res.status, 200);
  assert.equal(res.body.isActive, false);
  assert.equal(res.body.activeUserCount, 1);

  const stillAssigned = prisma._state.users.find((u) => u.id === 1);
  assert.equal(stillAssigned.departmentId, 1);
  assert.equal(stillAssigned.isActive, true);
});

test("PUT /api/admin/departments/:id returns 404 for a missing department", async () => {
  const { app, adminToken } = buildTestApp({ departments: SEED_DEPARTMENTS, users: [] });
  const res = await request(app)
    .put("/api/admin/departments/999")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Ghost" });
  assert.equal(res.status, 404);
});
