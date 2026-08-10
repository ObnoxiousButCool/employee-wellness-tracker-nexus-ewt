import { describe, expect, test } from "vitest";
import { parseSessionCookie } from "../lib/session";

describe("parseSessionCookie", () => {
  test("returns null when there is no cookie value", () => {
    expect(parseSessionCookie(undefined)).toBeNull();
  });

  test("returns null for malformed JSON", () => {
    expect(parseSessionCookie("{not-json")).toBeNull();
  });

  test("returns null when the parsed value has no role", () => {
    expect(parseSessionCookie(JSON.stringify({ userId: 1 }))).toBeNull();
  });

  test("parses a well-formed session payload", () => {
    const raw = JSON.stringify({ userId: 5, role: "ADMIN", departmentId: 2 });
    expect(parseSessionCookie(raw)).toEqual({ userId: 5, role: "ADMIN", departmentId: 2 });
  });
});
