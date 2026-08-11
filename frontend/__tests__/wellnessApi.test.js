import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { submitWellnessEntry, fetchWellnessHistory } from "../lib/wellnessApi";

function fakeResponse({ ok, status, body }) {
  return { ok, status, json: async () => body };
}

describe("wellnessApi client wrappers", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("submitWellnessEntry posts JSON and returns { ok, status, data } on success", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { id: 1 } }));

    const result = await submitWellnessEntry({ stressLevel: 5 });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/wellness/entries",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ stressLevel: 5 }) })
    );
    expect(result).toEqual({ ok: true, status: 200, data: { id: 1 } });
  });

  test("submitWellnessEntry surfaces a 422 body without throwing", async () => {
    global.fetch.mockResolvedValue(
      fakeResponse({ ok: false, status: 422, body: { errors: { stressLevel: "bad" } } })
    );

    const result = await submitWellnessEntry({ stressLevel: 99 });

    expect(result.ok).toBe(false);
    expect(result.data.errors.stressLevel).toBe("bad");
  });

  test("submitWellnessEntry returns a network-error shape when fetch throws", async () => {
    global.fetch.mockRejectedValue(new Error("network down"));

    const result = await submitWellnessEntry({});

    expect(result).toEqual({ ok: false, status: 0, data: { error: "Unable to reach the server. Please try again." } });
  });

  test("fetchWellnessHistory with no bounds omits query params", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    await fetchWellnessHistory();

    expect(global.fetch).toHaveBeenCalledWith("/api/wellness/entries/me", undefined);
  });

  test("fetchWellnessHistory with from/to builds the query string", async () => {
    global.fetch.mockResolvedValue(fakeResponse({ ok: true, status: 200, body: { data: [] } }));

    await fetchWellnessHistory({ from: "2026-08-01", to: "2026-08-11" });

    expect(global.fetch).toHaveBeenCalledWith("/api/wellness/entries/me?from=2026-08-01&to=2026-08-11", undefined);
  });
});
