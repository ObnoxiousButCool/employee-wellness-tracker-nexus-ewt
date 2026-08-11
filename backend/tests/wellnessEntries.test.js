const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { buildTestApp, signToken } = require("./helpers/testApp");

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function validEntryBody(overrides = {}) {
  return {
    stressLevel: 5,
    workHours: 8,
    sleepHours: 7,
    mood: "GOOD",
    energyLevel: "HIGH",
    ...overrides,
  };
}

test("POST /api/wellness/entries rejects unauthenticated requests with 401", async () => {
  const { app } = buildTestApp();
  const res = await request(app).post("/api/wellness/entries").send(validEntryBody());
  assert.equal(res.status, 401);
});

test("GET /api/wellness/entries/me rejects unauthenticated requests with 401", async () => {
  const { app } = buildTestApp();
  const res = await request(app).get("/api/wellness/entries/me");
  assert.equal(res.status, 401);
});

test("POST /api/wellness/entries returns 422 with field-level errors for invalid input", async () => {
  const { app } = buildTestApp();
  const token = signToken({ userId: 1, role: "EMPLOYEE" });
  const res = await request(app)
    .post("/api/wellness/entries")
    .set("Authorization", `Bearer ${token}`)
    .send({ stressLevel: 11, workHours: -1, sleepHours: 30, mood: "SAD", energyLevel: "UNKNOWN" });

  assert.equal(res.status, 422);
  assert.ok(res.body.errors.stressLevel);
  assert.ok(res.body.errors.workHours);
  assert.ok(res.body.errors.sleepHours);
  assert.ok(res.body.errors.mood);
  assert.ok(res.body.errors.energyLevel);
});

test("POST /api/wellness/entries returns 422 when workHours + sleepHours exceeds 24", async () => {
  const { app } = buildTestApp();
  const token = signToken({ userId: 1, role: "EMPLOYEE" });
  const res = await request(app)
    .post("/api/wellness/entries")
    .set("Authorization", `Bearer ${token}`)
    .send(validEntryBody({ workHours: 20, sleepHours: 10 }));

  assert.equal(res.status, 422);
  assert.match(res.body.errors.workHours, /must not exceed 24/);
});

test("POST /api/wellness/entries creates today's entry for the current user", async () => {
  const { app } = buildTestApp();
  const token = signToken({ userId: 1, role: "EMPLOYEE" });
  const res = await request(app)
    .post("/api/wellness/entries")
    .set("Authorization", `Bearer ${token}`)
    .send(validEntryBody());

  assert.equal(res.status, 200);
  assert.equal(res.body.userId, 1);
  assert.equal(res.body.entryDate, todayDateString());
  assert.equal(res.body.stressLevel, 5);
  assert.equal(res.body.workHours, 8);
  assert.equal(res.body.sleepHours, 7);
  assert.equal(res.body.mood, "GOOD");
  assert.equal(res.body.energyLevel, "HIGH");
});

test("POST /api/wellness/entries upserts (edits in place) on same-day resubmission", async () => {
  const { app } = buildTestApp();
  const token = signToken({ userId: 1, role: "EMPLOYEE" });

  const first = await request(app)
    .post("/api/wellness/entries")
    .set("Authorization", `Bearer ${token}`)
    .send(validEntryBody({ stressLevel: 5 }));
  const second = await request(app)
    .post("/api/wellness/entries")
    .set("Authorization", `Bearer ${token}`)
    .send(validEntryBody({ stressLevel: 9 }));

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.id, first.body.id);
  assert.equal(second.body.stressLevel, 9);

  const history = await request(app)
    .get("/api/wellness/entries/me")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(history.body.data.length, 1);
});

test("POST /api/wellness/entries rejects edits to a non-today entryDate with 403", async () => {
  const { app } = buildTestApp();
  const token = signToken({ userId: 1, role: "EMPLOYEE" });
  const res = await request(app)
    .post("/api/wellness/entries")
    .set("Authorization", `Bearer ${token}`)
    .send(validEntryBody({ entryDate: "2020-01-01" }));

  assert.equal(res.status, 403);
});

test("GET /api/wellness/entries/me returns only the current user's history, newest first", async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { app } = buildTestApp({
    wellnessEntries: [
      {
        id: 1,
        userId: 1,
        entryDate: yesterday,
        stressLevel: 3,
        workHours: 8,
        sleepHours: 7,
        mood: "NEUTRAL",
        energyLevel: "MEDIUM",
        createdAt: yesterday,
        updatedAt: yesterday,
      },
      {
        id: 2,
        userId: 2,
        entryDate: new Date(),
        stressLevel: 6,
        workHours: 8,
        sleepHours: 6,
        mood: "LOW",
        energyLevel: "LOW",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });
  const token = signToken({ userId: 1, role: "EMPLOYEE" });

  await request(app)
    .post("/api/wellness/entries")
    .set("Authorization", `Bearer ${token}`)
    .send(validEntryBody());

  const res = await request(app)
    .get("/api/wellness/entries/me")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
  assert.equal(res.body.data.every((e) => e.userId === 1), true);
  assert.equal(res.body.data[0].entryDate, todayDateString());
});

test("GET /api/wellness/entries/me returns 400 for a malformed date range", async () => {
  const { app } = buildTestApp();
  const token = signToken({ userId: 1, role: "EMPLOYEE" });
  const res = await request(app)
    .get("/api/wellness/entries/me?from=not-a-date")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 400);
});
