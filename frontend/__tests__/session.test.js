import { describe, expect, test } from "vitest";
import jwt from "jsonwebtoken";
import { parseSessionToken } from "../lib/session";

const JWT_SECRET = process.env.JWT_SECRET;

function sign(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256", expiresIn: "8h", ...options });
}

describe("parseSessionToken", () => {
  test("returns null when there is no cookie value", () => {
    expect(parseSessionToken(undefined)).toBeNull();
  });

  test("returns null for a malformed token", () => {
    expect(parseSessionToken("not-a-jwt")).toBeNull();
  });

  test("returns null when the payload has no role", () => {
    const token = sign({ userId: 1 });
    expect(parseSessionToken(token)).toBeNull();
  });

  test("verifies and decodes a well-formed, correctly signed token", () => {
    const token = sign({ userId: 5, role: "ADMIN", departmentId: 2 });
    expect(parseSessionToken(token)).toEqual({ userId: 5, role: "ADMIN", departmentId: 2 });
  });

  test("rejects a token signed with a different secret (forged cookie)", () => {
    const forged = jwt.sign({ userId: 1, role: "ADMIN", departmentId: null }, "not-the-real-secret", {
      algorithm: "HS256",
    });
    expect(parseSessionToken(forged)).toBeNull();
  });

  test("rejects an unsigned/none-alg token (a plain base64 JSON forgery)", () => {
    const forged = jwt.sign({ userId: 1, role: "ADMIN", departmentId: null }, undefined, {
      algorithm: "none",
    });
    expect(parseSessionToken(forged)).toBeNull();
  });

  test("rejects an expired token", () => {
    const token = sign({ userId: 1, role: "ADMIN", departmentId: null }, { expiresIn: "-1s" });
    expect(parseSessionToken(token)).toBeNull();
  });
});
