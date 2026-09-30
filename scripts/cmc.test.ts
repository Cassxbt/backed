import { afterEach, describe, expect, it, vi } from "vitest";
import { Cmc } from "./cmc";

const FAST = { spacingMs: 0, retryMs: 0, timeoutMs: 1000 };
const ok = (data: unknown) => ({ status: { error_code: 0, credit_count: 1 }, data });

function serve(...bodies: { status?: number; body: unknown }[]) {
  const fetch = vi.fn();
  for (const b of bodies) {
    const text = typeof b.body === "string" ? b.body : JSON.stringify(b.body);
    fetch.mockResolvedValueOnce(new Response(text, { status: b.status ?? 200 }));
  }
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("Cmc.get", () => {
  it("returns data from a well-formed envelope, including an empty list", async () => {
    serve({ body: ok([]) });
    const cmc = new Cmc("k", FAST);
    await expect(cmc.get("/v1/exchange/assets", { id: 89 })).resolves.toEqual([]);
    expect(cmc.credits).toBe(1);
  });

  it("accepts error_code as the string 0", async () => {
    serve({ body: { status: { error_code: "0", credit_count: 1 }, data: { exchanges: [] } } });
    await expect(new Cmc("k", FAST).get("/v5/x")).resolves.toEqual({ exchanges: [] });
  });

  it.each([
    ["an empty object", {}],
    ["a status without data", { status: { error_code: 0 } }],
    ["null data", { status: { error_code: 0 }, data: null }],
    ["a missing error code", { status: {}, data: [] }],
    ["an array body", []],
  ])("rejects a 200 with %s", async (_, body) => {
    serve(...Array.from({ length: 4 }, () => ({ body })));
    await expect(new Cmc("k", FAST).get("/v1/exchange/assets")).rejects.toThrow();
  });

  it("retries a body that is not JSON, then fails", async () => {
    const fetch = serve(...Array.from({ length: 4 }, () => ({ body: "<html>gateway</html>" })));
    await expect(new Cmc("k", FAST).get("/v1/exchange/assets")).rejects.toThrow(/not a CMC envelope/);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("recovers when a retry returns a good envelope", async () => {
    serve({ status: 502, body: "bad gateway" }, { body: ok([1]) });
    await expect(new Cmc("k", FAST).get("/v1/exchange/assets")).resolves.toEqual([1]);
  });

  it("does not retry a plan error and reports it", async () => {
    const fetch = serve({ status: 403, body: { status: { error_code: 1006, error_message: "plan" }, data: null } });
    await expect(new Cmc("k", FAST).get("/v1/x")).rejects.toThrow(/1006/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
