import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import jwt from "jsonwebtoken";
import { POST as loginPOST } from "../app/api/auth/login/route";
import { POST as logoutPOST } from "../app/api/auth/logout/route";

const JWT_SECRET = process.env.JWT_SECRET;

function jsonRequest(body) {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeBackendResponse({ status, body, setCookieHeaders = [] }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { getSetCookie: () => setCookieHeaders },
  };
}

describe("POST /api/auth/login route handler", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("forwards { email, password } unchanged to the backend and relays ewt_token verbatim", async () => {
    const token = jwt.sign({ userId: 1, role: "ADMIN", departmentId: 3 }, JWT_SECRET, { algorithm: "HS256" });
    const backendSetCookie = `ewt_token=${token}; Max-Age=28800; Path=/; HttpOnly; SameSite=Strict`;
    global.fetch.mockResolvedValue(
      fakeBackendResponse({
        status: 200,
        body: { userId: 1, role: "ADMIN", departmentId: 3 },
        setCookieHeaders: [backendSetCookie],
      })
    );

    const res = await loginPOST(jsonRequest({ email: "admin@ewt.test", password: "correct-password" }));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/login"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "admin@ewt.test", password: "correct-password" }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ userId: 1, role: "ADMIN", departmentId: 3 });

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain(`ewt_token=${token}`);
    expect(setCookie).toContain("ewt_session=");
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  test("relays a 401 from the backend without setting any cookies", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({ status: 401, body: { error: "Invalid credentials" } })
    );

    const res = await loginPOST(jsonRequest({ email: "nobody@ewt.test", password: "wrong" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid credentials" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("relays a 403 for an inactive account", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({ status: 403, body: { error: "Account is inactive" } })
    );

    const res = await loginPOST(jsonRequest({ email: "inactive@ewt.test", password: "correct-password" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Account is inactive" });
  });
});

describe("POST /api/auth/logout route handler", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function logoutRequest(cookieHeader = "") {
    return new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { cookie: cookieHeader },
    });
  }

  test("relays the backend's cookie-clearing response and clears ewt_session", async () => {
    global.fetch.mockResolvedValue(
      fakeBackendResponse({
        status: 200,
        body: { message: "Logged out" },
        setCookieHeaders: ["ewt_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict"],
      })
    );

    const res = await logoutPOST(logoutRequest("ewt_token=abc; ewt_session=xyz"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "Logged out" });
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/ewt_session=;/);
    expect(setCookie).toMatch(/ewt_token=;/);
  });

  test("still clears both cookies locally when the backend proxy is unreachable (no half-signed-out state)", async () => {
    global.fetch.mockRejectedValue(new Error("network down"));

    const res = await logoutPOST(logoutRequest("ewt_token=abc; ewt_session=xyz"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/logged out locally/i);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/ewt_session=;/);
    expect(setCookie).toMatch(/ewt_token=;/);
  });
});
