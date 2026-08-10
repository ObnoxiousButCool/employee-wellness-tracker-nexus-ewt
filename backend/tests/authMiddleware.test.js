const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { buildTestApp, signToken } = require("./helpers/testApp");

test("authenticate accepts a valid ewt_token cookie, not just Authorization header", async () => {
  const { app } = buildTestApp({ departments: [], users: [] });
  const token = signToken({ role: "ADMIN" });
  const res = await request(app).get("/api/admin/departments").set("Cookie", [`ewt_token=${token}`]);
  assert.equal(res.status, 200);
});

test("authenticate rejects a token signed with the wrong secret", async () => {
  const { app } = buildTestApp({ departments: [], users: [] });
  const forged = jwt.sign({ userId: 1, role: "ADMIN" }, "wrong-secret", { expiresIn: "8h" });
  const res = await request(app).get("/api/admin/departments").set("Authorization", `Bearer ${forged}`);
  assert.equal(res.status, 401);
});

test("requireRole rejects MANAGER from admin-only routes", async () => {
  const { app } = buildTestApp({ departments: [], users: [] });
  const token = signToken({ role: "MANAGER" });
  const res = await request(app).get("/api/admin/departments").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});
