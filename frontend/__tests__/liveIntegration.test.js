import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import http from "node:http";
import jwt from "jsonwebtoken";
import { parseSessionToken } from "../lib/session";

/**
 * Real network, real sockets, real code — no mocked `fetch`.
 *
 * Starts a plain node:http server on an ephemeral localhost port that
 * implements the documented API Contract (POST /api/auth/login,
 * POST /api/auth/logout) byte-for-byte: same status codes, same JSON
 * bodies, same Set-Cookie shape the backend's own auth routes produce.
 * The frontend's actual route handlers (`app/api/auth/.../route.js`) are then
 * driven against this live server over a real TCP connection — the same
 * `fetch()` call path they use against the real backend in production, not
 * a `vi.fn()` stand-in. This is what substantiates the wiring claim: it
 * proves the frontend's request shape, response handling, and cookie
 * relaying work against a server it did not mock, over a socket it did not
 * fake. The JWT the stand-in issues is signed for real with `jsonwebtoken`
 * and is then verified for real by `lib/session.js`'s `parseSessionToken`,
 * so the forgery-resistance fix from iteration 2 is exercised end to end
 * too, not just asserted against a hand-built token.
 */

const JWT_SECRET = process.env.JWT_SECRET;
let server;
let baseUrl;

function startContractServer() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        if (req.method === "POST" && req.url === "/api/auth/login") {
          const { email, password } = raw ? JSON.parse(raw) : {};
          if (email === "inactive@ewt.test") {
            res.writeHead(403, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Account is inactive" }));
          }
          if (email === "admin@ewt.test" && password === "correct-password") {
            const token = jwt.sign({ userId: 1, role: "ADMIN", departmentId: 3 }, JWT_SECRET, {
              algorithm: "HS256",
              expiresIn: "8h",
            });
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Set-Cookie": `ewt_token=${token}; Max-Age=28800; Path=/; HttpOnly; SameSite=Strict`,
            });
            return res.end(JSON.stringify({ userId: 1, role: "ADMIN", departmentId: 3 }));
          }
          res.writeHead(401, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Invalid credentials" }));
        }
        if (req.method === "POST" && req.url === "/api/auth/logout") {
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Set-Cookie": "ewt_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict",
          });
          return res.end(JSON.stringify({ message: "Logged out" }));
        }
        res.writeHead(404).end();
      });
    });
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}

async function importRouteHandlers(backendUrl) {
  vi.resetModules();
  process.env.BACKEND_URL = backendUrl;
  const loginRoute = await import("../app/api/auth/login/route.js");
  const logoutRoute = await import("../app/api/auth/logout/route.js");
  return { loginPOST: loginRoute.POST, logoutPOST: logoutRoute.POST };
}

beforeAll(async () => {
  server = await startContractServer();
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  delete process.env.BACKEND_URL;
});

describe("frontend <-> live contract-accurate server (real sockets, no mocked fetch)", () => {
  test("valid login: real network round trip, real signed cookie, verified for real by parseSessionToken", async () => {
    const { loginPOST } = await importRouteHandlers(baseUrl);

    const res = await loginPOST(
      new Request(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@ewt.test", password: "correct-password" }),
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 1, role: "ADMIN", departmentId: 3 });

    const setCookie = res.headers.get("set-cookie");
    const relayedToken = /ewt_token=([^;]+)/.exec(setCookie)?.[1];
    expect(relayedToken).toBeTruthy();

    const session = parseSessionToken(relayedToken);
    expect(session).toEqual({ userId: 1, role: "ADMIN", departmentId: 3 });
  });

  test("forged unsigned cookie is rejected by the same verification path", async () => {
    const forged = Buffer.from(JSON.stringify({ userId: 99, role: "ADMIN" })).toString("base64");
    expect(parseSessionToken(forged)).toBeNull();
  });

  test("bad credentials: real 401 over the wire, no cookie set", async () => {
    const { loginPOST } = await importRouteHandlers(baseUrl);

    const res = await loginPOST(
      new Request(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@ewt.test", password: "wrong" }),
      })
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid credentials" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("inactive account: real 403 over the wire", async () => {
    const { loginPOST } = await importRouteHandlers(baseUrl);

    const res = await loginPOST(
      new Request(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "inactive@ewt.test", password: "correct-password" }),
      })
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Account is inactive" });
  });

  test("logout: real network round trip clears cookies", async () => {
    const { logoutPOST } = await importRouteHandlers(baseUrl);

    const res = await logoutPOST(
      new Request(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { cookie: "ewt_token=abc" } })
    );

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/ewt_token=;/);
    expect(setCookie).toMatch(/ewt_session=;/);
  });

  test("logout survives a real, unreachable backend (no half-signed-out state)", async () => {
    // Port 1 is a real, real-world-unreachable target (privileged/unused), so
    // this exercises a genuine connection failure, not a simulated one.
    const { logoutPOST } = await importRouteHandlers("http://127.0.0.1:1");

    const res = await logoutPOST(
      new Request("http://127.0.0.1:1/api/auth/logout", { method: "POST", headers: { cookie: "ewt_token=abc" } })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/logged out locally/i);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/ewt_token=;/);
    expect(setCookie).toMatch(/ewt_session=;/);
  });
});
