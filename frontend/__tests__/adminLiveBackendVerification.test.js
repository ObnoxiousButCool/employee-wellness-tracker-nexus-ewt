import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

/**
 * Genuine live-backend verification: boots the REAL `backend/src/app.js`
 * (the actual Express app, controllers, validators, and Prisma-error-shape
 * handling the backend layer wrote) over a real TCP socket, wired to the
 * backend's own `tests/helpers/fakePrisma.js` in-memory double (no live
 * Postgres in this environment — the same constraint the backend layer's
 * own test suite runs under). The frontend's actual `/api/admin/*` BFF
 * route handlers are then driven against that real server, with no mocked
 * `fetch` and no re-implementation of backend behavior in this repo layer.
 *
 * `backend/` is a sibling layer maintained on its own branch and is not
 * always present in this branch's working tree (see PROJECT_CONTEXT.md).
 * When it isn't, this suite skips with a clear reason instead of failing
 * CI; when it is (e.g. after the two layers are merged, or when both
 * branches are checked out together as during this verification pass),
 * it runs for real. This replaces the previous claim of having "verified
 * end-to-end" against a hand-written contract stand-in — that stand-in
 * (`helpers/fakeAdminBackend.js`) remains as the always-on regression
 * suite in `adminUsersLiveIntegration.test.js` /
 * `adminDepartmentsLiveIntegration.test.js`, but it is a re-implementation
 * of the contract, not the real backend, and must not be described as
 * live-backend verification.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendAppPath = path.resolve(__dirname, "../../backend/src/app.js");
const backendAvailable = fs.existsSync(backendAppPath);

describe.skipIf(!backendAvailable)(
  "frontend <-> REAL backend/src/app.js (real Express app, real fakePrisma double, real sockets, no mocks)",
  () => {
    let server;
    let baseUrl;
    let adminToken;

    beforeAll(async () => {
      const require = createRequire(import.meta.url);
      const createApp = require(backendAppPath);
      const { createFakePrisma } = require(path.resolve(__dirname, "../../backend/tests/helpers/fakePrisma.js"));
      const jwt = require("jsonwebtoken");

      // vitest.setup.js already sets JWT_SECRET ("test-secret") before this file
      // loads; backend/src/config/env.js snapshots it the moment app.js is
      // require()'d above, so we sign with that same already-set value rather
      // than reassigning it here (reassigning after the require would be too
      // late and would desync the token's signature from what the real
      // backend's authenticate middleware verifies against).
      const prisma = createFakePrisma({
        roles: [
          { id: 1, name: "ADMIN" },
          { id: 2, name: "MANAGER" },
          { id: 3, name: "EMPLOYEE" },
        ],
        departments: [{ id: 1, name: "Engineering", isActive: true }],
        users: [
          {
            id: 1,
            name: "Seed Admin",
            email: "seed-admin@ewt.test",
            passwordHash: "irrelevant-for-these-routes",
            roleId: 1,
            departmentId: 1,
            isActive: true,
          },
        ],
      });
      const app = createApp({ prisma });

      server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      adminToken = jwt.sign({ userId: 1, role: "ADMIN", departmentId: 1 }, process.env.JWT_SECRET, {
        expiresIn: "8h",
      });
      process.env.BACKEND_URL = baseUrl;
    });

    afterAll(() => {
      server?.close();
    });

    function req(path_, init = {}) {
      return new Request(`${baseUrl}${path_}`, {
        ...init,
        headers: { cookie: `ewt_token=${adminToken}`, ...(init.headers || {}) },
      });
    }

    test("GET /api/admin/users (BFF) lists the seeded admin via the real backend, no passwordHash", async () => {
      const { GET } = await import("../app/api/admin/users/route.js");
      const res = await GET(req("/api/admin/users"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({ id: 1, name: "Seed Admin", role: "ADMIN", department: "Engineering" });
      expect(body.data[0].passwordHash).toBeUndefined();
    });

    test("GET /api/admin/users (BFF) returns the real backend's 401 when unauthenticated", async () => {
      const { GET } = await import("../app/api/admin/users/route.js");
      const res = await GET(new Request(`${baseUrl}/api/admin/users`));
      expect(res.status).toBe(401);
    });

    test("POST /api/admin/users (BFF) creates a user, then a duplicate email gets the real backend's 409", async () => {
      const { POST } = await import("../app/api/admin/users/route.js");

      const created = await POST(
        req("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ name: "New Hire", email: "new-hire@ewt.test", password: "password1", roleId: 3 }),
        })
      );
      expect(created.status).toBe(201);
      expect((await created.json()).name).toBe("New Hire");

      const dup = await POST(
        req("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ name: "Someone Else", email: "new-hire@ewt.test", password: "password1", roleId: 3 }),
        })
      );
      expect(dup.status).toBe(409);
    });

    test("POST /api/admin/departments (BFF) then PUT deactivate does not cascade to users, matching the documented contract", async () => {
      const { POST } = await import("../app/api/admin/departments/route.js");
      const { PUT } = await import("../app/api/admin/departments/[id]/route.js");

      const created = await POST(
        req("/api/admin/departments", { method: "POST", body: JSON.stringify({ name: "Sales" }) })
      );
      expect(created.status).toBe(201);
      const dept = await created.json();

      const moved = await import("../app/api/admin/users/[id]/route.js");
      await moved.PUT(req("/api/admin/users/1", { method: "PUT", body: JSON.stringify({ departmentId: dept.id }) }), {
        params: { id: "1" },
      });

      const deactivated = await PUT(
        req(`/api/admin/departments/${dept.id}`, { method: "PUT", body: JSON.stringify({ isActive: false }) }),
        { params: { id: String(dept.id) } }
      );
      expect(deactivated.status).toBe(200);
      const deactivatedBody = await deactivated.json();
      expect(deactivatedBody.isActive).toBe(false);

      const { GET } = await import("../app/api/admin/users/route.js");
      const usersAfter = await GET(req(`/api/admin/users?department=${dept.id}`));
      const usersAfterBody = await usersAfter.json();
      expect(usersAfterBody.data[0].isActive).toBe(true);
      expect(usersAfterBody.data[0].departmentId).toBe(dept.id);
    });

    test("POST /api/admin/departments (BFF) rejects a duplicate name with the real backend's 409", async () => {
      const { POST } = await import("../app/api/admin/departments/route.js");
      const res = await POST(
        req("/api/admin/departments", { method: "POST", body: JSON.stringify({ name: "Engineering" }) })
      );
      expect(res.status).toBe(409);
    });
  }
);
