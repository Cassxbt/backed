import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { replaySnapshot } from "./replay";
import type { Snapshot } from "./snapshot";

const load = (): Snapshot => JSON.parse(readFileSync("data/snapshot.json", "utf8"));

describe("replay of the shipped snapshot", () => {
  it("reproduces every exchange's totals from its shipped holdings", () => {
    expect(replaySnapshot(load())).toEqual([]);
  });

  it("detects a changed holding balance", () => {
    const s = load();
    const e = s.exchanges.find((x) => x.slug === "lbank")!;
    e.holdings[0].usd *= 2;
    expect(replaySnapshot(s).some((p) => p.startsWith("lbank"))).toBe(true);
  });

  it("detects a changed token supply", () => {
    const s = load();
    const e = s.exchanges.find((x) => x.slug === "lbank")!;
    const flagged = e.holdings.find((h) => h.flag === "unverified")!;
    s.tokens[String(flagged.cryptoId)].circulatingSupply = 1e15;
    expect(replaySnapshot(s).some((p) => p.startsWith("lbank"))).toBe(true);
  });

  it("detects a changed stored total", () => {
    const s = load();
    s.exchanges[0].passedUsd += 1e6;
    expect(replaySnapshot(s).length).toBeGreaterThan(0);
  });
});
