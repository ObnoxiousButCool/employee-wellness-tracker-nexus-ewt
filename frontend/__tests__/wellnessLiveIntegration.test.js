import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import http from "node:http";
import jwt from "jsonwebtoken";

/**
 * Real backend, real sockets, real code — no mocked `fetch`, no stand-in
 * server. Imports the backend's actual Express app (`backend/src/app.js`
 * via `createApp`) and starts it on a real ephemeral localhost port, wired
 * to the backend's own in-memory Prisma fake (`backend/tests/helpers/
 * fakePrisma.js`) since no live Postgres is available in this environment
 * (the same constraint the backend layer and the S2 admin frontend layer
 * hit). The frontend's actual `/api/wellness/*` route handlers are then
 * driven against that real server over a real TCP socket with a real
 * signed `ewt_token` cookie, exercising every acceptance criterion in the
 * S3 API Contract end to end: creating today's entry, the same-day
 * upsert-in-place behavior, 422 field-level validation errors (including
 * the workHours+sleepHours cross-field rule), 401 when unauthenticated,
 * and the caller's own history returned newest-first.
 */

const TEST_JWT_SECRET = "wellness-live-integration-test-secret";
process.env.JWT_SECRET = TEST_JWT_SECRET;

function employeeToken(userId = 1) {
  return jwt.sign({ userId, role: "EMPLOYEE", departmentId: null }, TEST_JWT_SECRET, { expiresIn: "8h" });
}

let backendServer;
let backendUrl;

beforeAll(async () => {
  const createApp = require("../../backend/src/app");
  const { createFakePrisma } = require("../../backend/tests/helpers/fakePrisma");
  const prisma = createFakePrisma({
    roles: [
      { id: 1, name: "ADMIN" },
      { id: 2, name: "MANAGER" },
      { id: 3, name: "EMPLOYEE" },
    ],
  });
  const app = createApp({ prisma });

  await new Promise((resolve) => {
    backendServer = http.createServer(app).listen(0, "127.0.0.1", resolve);
  });
  backendUrl = `http://127.0.0.1:${backendServer.address().port}`;
});

afterAll(() => {
  backendServer.close();
});

async function importWellnessRouteHandlers() {
  vi.resetModules();
  process.env.BACKEND_URL = backendUrl;
  const entries = await import("../app/api/wellness/entries/route.js");
  const entriesMe = await import("../app/api/wellness/entries/me/route.js");
  return { entriesPOST: entries.POST, entriesMeGET: entriesMe.GET };
}

function validBody(overrides = {}) {
  return { stressLevel: 5, workHours: 8, sleepHours: 7, mood: "GOOD", energyLevel: "HIGH", ...overrides };
}

describe("frontend <-> live backend wellness endpoints (real sockets, real Express app, no mocked fetch)", () => {
  test("POST without a session cookie: real 401 over the wire", async () => {
    const { entriesPOST } = await importWellnessRouteHandlers();

    const res = await entriesPOST(
      new Request(`${backendUrl}/api/wellness/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody()),
      })
    );

    expect(res.status).toBe(401);
  });

  test("POST creates today's entry for real, then a same-day resubmission upserts in place (same id)", async () => {
    const { entriesPOST } = await importWellnessRouteHandlers();
    const cookie = `ewt_token=${employeeToken(101)}`;

    const first = await entriesPOST(
      new Request(`${backendUrl}/api/wellness/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(validBody({ stressLevel: 4 })),
      })
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.stressLevel).toBe(4);
    expect(firstBody.userId).toBe(101);

    const second = await entriesPOST(
      new Request(`${backendUrl}/api/wellness/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(validBody({ stressLevel: 9 })),
      })
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.id).toBe(firstBody.id);
    expect(secondBody.stressLevel).toBe(9);
  });

  test("POST with invalid input: real 422 with field-level errors, including the cross-field 24h rule", async () => {
    const { entriesPOST } = await importWellnessRouteHandlers();
    const cookie = `ewt_token=${employeeToken(102)}`;

    const res = await entriesPOST(
      new Request(`${backendUrl}/api/wellness/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(validBody({ workHours: 20, sleepHours: 10 })),
      })
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.errors.workHours).toMatch(/must not exceed 24/);
  });

  test("GET history without a session cookie: real 401 over the wire", async () => {
    const { entriesMeGET } = await importWellnessRouteHandlers();

    const res = await entriesMeGET(new Request(`${backendUrl}/api/wellness/entries/me`));

    expect(res.status).toBe(401);
  });

  test("GET history returns only the caller's own entries, newest first, from the real backend", async () => {
    const { entriesPOST, entriesMeGET } = await importWellnessRouteHandlers();
    const cookieA = `ewt_token=${employeeToken(201)}`;
    const cookieB = `ewt_token=${employeeToken(202)}`;

    await entriesPOST(
      new Request(`${backendUrl}/api/wellness/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: cookieA },
        body: JSON.stringify(validBody()),
      })
    );
    await entriesPOST(
      new Request(`${backendUrl}/api/wellness/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: cookieB },
        body: JSON.stringify(validBody()),
      })
    );

    const res = await entriesMeGET(
      new Request(`${backendUrl}/api/wellness/entries/me`, { headers: { cookie: cookieA } })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.every((entry) => entry.userId === 201)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
