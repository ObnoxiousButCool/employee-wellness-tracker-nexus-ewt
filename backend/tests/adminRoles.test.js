const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { buildTestApp } = require("./helpers/testApp");

test("GET /api/admin/roles requires an admin session", async () => {
  const { app } = buildTestApp();
  const res = await request(app).get("/api/admin/roles");
  assert.equal(res.status, 401);
});

test("GET /api/admin/roles lists the seeded roles ordered by id", async () => {
  const { app, adminToken } = buildTestApp();
  const res = await request(app).get("/api/admin/roles").set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, [
    { id: 1, name: "ADMIN" },
    { id: 2, name: "MANAGER" },
    { id: 3, name: "EMPLOYEE" },
  ]);
});
