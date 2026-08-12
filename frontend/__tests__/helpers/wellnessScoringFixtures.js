import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";

/**
 * Shared fixtures for the S6 wellness-scoring live-backend verification
 * suite, split across `wellnessScoringListLiveBackendVerification.test.js`
 * and `wellnessScoringDepartmentLiveBackendVerification.test.js` (see the
 * S6 fix iteration 2 Change Log entry for why). Starts the real backend
 * Express app (`backend/src/app.js` via `createApp`) on a real ephemeral
 * localhost port, wired to this frontend layer's own in-memory Prisma fake
 * (`dashboardFakePrisma.js`, S5) -- no mocked `fetch`, no stand-in server.
 *
 * `backend/` is a sibling layer on its own branch; this story's frontend
 * branch was cut before the S6 backend routes (`departmentWellnessRoutes.js`)
 * were committed, so they are not always present in this branch's working
 * tree. `wellnessScoringBackendAvailable` lets each test file skip with a
 * clear reason instead of failing CI when they're absent, and run for real
 * once the two layers are merged (or both branches are checked out
 * together, as during this verification pass) -- same pattern
 * `adminLiveBackendVerification.test.js` (S2 iteration 3) established.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const wellnessScoringBackendAvailable = fs.existsSync(
  path.resolve(__dirname, "../../../backend/src/routes/departmentWellnessRoutes.js")
);

export const TEST_JWT_SECRET = "wellness-scoring-live-verification-secret";
process.env.JWT_SECRET = TEST_JWT_SECRET;

export function token(userId, role, departmentId) {
  return jwt.sign({ userId, role, departmentId }, TEST_JWT_SECRET, { expiresIn: "8h" });
}

export const engineeringId = 1;
export const salesId = 2;
export const emptyDeptId = 3;

export const empThrivingId = 10; // Engineering, hand-computed score 96 (Thriving)
export const empCriticalId = 11; // Engineering, hand-computed score 8 (Critical)
export const empStableId = 20; // Sales, hand-computed score 65 (Stable)
export const empNoEntriesId = 30; // Empty dept, no entries at all
export const managerId = 40; // Engineering manager

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export async function startWellnessScoringBackend() {
  const { default: createApp } = await import("../../../backend/src/app.js");
  const { createDashboardFakePrisma } = await import("./dashboardFakePrisma.js");

  const prisma = createDashboardFakePrisma({
    departments: [
      { id: engineeringId, name: "Engineering", isActive: true },
      { id: salesId, name: "Sales", isActive: true },
      { id: emptyDeptId, name: "Empty", isActive: true },
    ],
    users: [
      { id: empThrivingId, name: "Thriving Employee", departmentId: engineeringId, isActive: true, role: { name: "EMPLOYEE" } },
      { id: empCriticalId, name: "Critical Employee", departmentId: engineeringId, isActive: true, role: { name: "EMPLOYEE" } },
      { id: empStableId, name: "Stable Employee", departmentId: salesId, isActive: true, role: { name: "EMPLOYEE" } },
      { id: empNoEntriesId, name: "No Entries Employee", departmentId: emptyDeptId, isActive: true, role: { name: "EMPLOYEE" } },
      { id: managerId, name: "Manny Manager", departmentId: engineeringId, isActive: true, role: { name: "MANAGER" } },
    ],
    wellnessEntries: [
      // empThrivingId: an older, much worse entry, then a latest entry that computes to 96.
      { id: 1, userId: empThrivingId, entryDate: daysAgo(5), stressLevel: 10, workHours: 8, sleepHours: 0, mood: "LOW", energyLevel: "VERY_LOW" },
      { id: 2, userId: empThrivingId, entryDate: daysAgo(0), stressLevel: 1, workHours: 8, sleepHours: 8, mood: "GREAT", energyLevel: "VERY_HIGH" },
      // empCriticalId: single entry, computes to 8.
      { id: 3, userId: empCriticalId, entryDate: daysAgo(0), stressLevel: 10, workHours: 8, sleepHours: 2, mood: "LOW", energyLevel: "VERY_LOW" },
      // empStableId: single entry, computes to 65.
      { id: 4, userId: empStableId, entryDate: daysAgo(0), stressLevel: 5, workHours: 8, sleepHours: 8, mood: "GOOD", energyLevel: "MEDIUM" },
      // empNoEntriesId: intentionally none.
    ],
  });

  const app = createApp({ prisma });
  const server = await new Promise((resolve) => {
    const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s));
  });
  const backendUrl = `http://127.0.0.1:${server.address().port}`;

  return { server, backendUrl };
}

export function req(url, cookie) {
  return new Request(url, { headers: cookie ? { cookie } : {} });
}
