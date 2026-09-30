import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSnapshot, historyPoint, makeReceipt } from "./build";
import { METHOD_VERSION } from "./checks";
import { type ExchangeSource, type Inputs, sha256, validateInputs } from "./inputs";
import { replay, replayReceipt } from "./replay";
import type { AssetRow } from "./rows";
import type { Snapshot } from "./snapshot";
import type { Token } from "./types";

const row = (wallet: string, token: number, balance: number, price: number | null): AssetRow => ({
  wallet_address: wallet,
  balance,
  platform: { crypto_id: 1027, symbol: "ETH", name: "Ethereum" },
  currency: { crypto_id: token, symbol: `T${token}`, price_usd: price },
});

const token = (id: number, over: Partial<Token> = {}): Token => ({
  id,
  symbol: `T${id}`,
  name: `Token ${id}`,
  price: 1,
  circulatingSupply: 1_000,
  totalSupply: 1_000,
  selfReportedCirculatingSupply: null,
  marketCap: 1_000,
  volume24h: 100,
  marketPairs: 10,
  tags: [],
  ...over,
});

const exchange = (id: number, slug: string, assets: AssetRow[], over: Partial<ExchangeSource> = {}): ExchangeSource => ({
  id,
  slug,
  name: slug.toUpperCase(),
  porAuditStatus: 0,
  spotVolumeUsd: 1e6,
  openInterestReported: null,
  inLiquidationResponse: false,
  assets,
  ...over,
});

function fixture(): Inputs {
  const exchanges = [
    exchange(1, "alpha", [row("0x" + "a".repeat(40), 1, 500, 2), row("0x" + "b".repeat(40), 2, 5_000, 1), row("w3", 3, 10, 50)], {
      openInterestReported: 9_000,
      inLiquidationResponse: true,
    }),
    exchange(2, "beta", [row("w1", 1, 100, 2), row("w2", 4, 1_000, 1)], { openInterestReported: 0 }),
    exchange(3, "gamma", []),
  ];
  return {
    methodVersion: METHOD_VERSION,
    startedAt: "2026-09-30T00:00:00.000Z",
    capturedAt: "2026-09-30T00:05:00.000Z",
    exchangesListed: 10,
    exchanges,
    tokens: { "1": token(1), "2": token(2, { circulatingSupply: 1_000 }), "3": token(3, { marketPairs: 1 }), "4": token(4, { tags: ["stablecoin"] }) },
    calls: exchanges.map((e) => ({ path: "/v1/exchange/assets", params: { id: String(e.id) }, credits: 1, errorCode: 0, at: "2026-09-30T00:01:00.000Z" })),
  };
}

function publish(inputs: Inputs) {
  const inputsText = JSON.stringify(inputs);
  const snapshot = buildSnapshot(inputs, sha256(inputsText));
  return { inputsText, snapshotText: JSON.stringify(snapshot), historyText: JSON.stringify([historyPoint(snapshot)]) };
}

function tamperSnapshot(p: ReturnType<typeof publish>, edit: (s: Snapshot) => void) {
  const s: Snapshot = JSON.parse(p.snapshotText);
  edit(s);
  return replay(p.inputsText, JSON.stringify(s), p.historyText);
}

const alpha = (s: Snapshot) => s.exchanges.find((e) => e.slug === "alpha")!;

describe("replay", () => {
  it("passes an untouched publication and classifies the fixture as expected", () => {
    const p = publish(fixture());
    expect(replay(p.inputsText, p.snapshotText, p.historyText)).toEqual([]);
    const s: Snapshot = JSON.parse(p.snapshotText);
    expect(alpha(s).excessUsd).toBe(4_000);
    expect(alpha(s).thinUsd).toBe(500);
    expect(alpha(s).cover).toBeCloseTo(9_000 / 6_500);
    expect(s.exchanges.find((e) => e.slug === "beta")!.openInterestReportedZero).toBe(true);
    expect(s.noWallets.map((e) => e.slug)).toEqual(["gamma"]);
  });

  it.each([
    ["a holding's flag", (s: Snapshot) => void (alpha(s).holdings.find((h) => h.flag === "thin")!.flag = null)],
    ["a holding's flagged value", (s: Snapshot) => void (alpha(s).holdings.find((h) => h.flag)!.flaggedUsd = 0)],
    ["a holding's exemption", (s: Snapshot) => void (s.exchanges[1].holdings.find((h) => h.exempt)!.exempt = false)],
    ["an exchange total", (s: Snapshot) => void (alpha(s).passedUsd += 1)],
    ["the open interest ratio", (s: Snapshot) => void (alpha(s).cover = 0.5)],
    ["open interest", (s: Snapshot) => void (alpha(s).openInterestUsd = 1)],
    ["liquidation presence", (s: Snapshot) => void (alpha(s).inLiquidationResponse = false)],
    ["a zero open interest marker", (s: Snapshot) => void (s.exchanges[1].openInterestReportedZero = false)],
    ["a removed exchange", (s: Snapshot) => void s.exchanges.pop()],
    ["a removed refusal", (s: Snapshot) => void s.noWallets.pop()],
    ["a token's supply", (s: Snapshot) => void (s.tokens["1"].circulatingSupply = 1)],
    ["the credit count", (s: Snapshot) => void (s.credits = 0)],
    ["the capture time", (s: Snapshot) => void (s.generatedAt = "2026-10-01T00:00:00.000Z")],
  ])("fails when the snapshot changes %s", (_, edit) => {
    expect(tamperSnapshot(publish(fixture()), edit).length).toBeGreaterThan(0);
  });

  it("fails on an unknown method version in either file", () => {
    const p = publish(fixture());
    expect(tamperSnapshot(p, (s) => void (s.methodVersion = "checks-v999"))).toContainEqual(expect.stringContaining("method"));
    const inputs = fixture();
    inputs.methodVersion = "checks-v999";
    const q = publish(inputs);
    expect(replay(q.inputsText, q.snapshotText)).toContainEqual(expect.stringContaining("method"));
  });

  it("fails when the inputs change without the snapshot hash", () => {
    const p = publish(fixture());
    const inputs: Inputs = JSON.parse(p.inputsText);
    inputs.exchanges[0].assets[0].balance *= 2;
    expect(replay(JSON.stringify(inputs), p.snapshotText)).toContainEqual(expect.stringContaining("hash"));
  });

  it("fails when the inputs and hash change but the results do not", () => {
    const p = publish(fixture());
    const inputs: Inputs = JSON.parse(p.inputsText);
    inputs.exchanges[0].openInterestReported = 1;
    const inputsText = JSON.stringify(inputs);
    const s: Snapshot = JSON.parse(p.snapshotText);
    s.inputsSha256 = sha256(inputsText);
    expect(replay(inputsText, JSON.stringify(s)).length).toBeGreaterThan(0);
  });

  it.each([
    ["no exchanges", (i: Inputs) => void (i.exchanges = [])],
    ["a duplicated exchange", (i: Inputs) => void i.exchanges.push({ ...i.exchanges[0] })],
    ["an exchange with no assets call", (i: Inputs) => void i.calls.pop()],
    ["an asset list that is not a list", (i: Inputs) => void ((i.exchanges[0] as { assets: unknown }).assets = null)],
    ["negative open interest", (i: Inputs) => void (i.exchanges[0].openInterestReported = -5)],
    ["fewer listed than checked", (i: Inputs) => void (i.exchangesListed = 1)],
  ])("rejects inputs with %s even when rebuilt consistently", (_, edit) => {
    const inputs = fixture();
    edit(inputs);
    const inputsText = JSON.stringify(inputs);
    let snapshot: Snapshot;
    try {
      snapshot = buildSnapshot(inputs, sha256(inputsText));
    } catch {
      snapshot = { ...fixtureSnapshotShell(), inputsSha256: sha256(inputsText) };
    }
    expect(validateInputs(inputs).length).toBeGreaterThan(0);
    expect(replay(inputsText, JSON.stringify(snapshot)).length).toBeGreaterThan(0);
  });

  it("fails when the latest history point disagrees", () => {
    const p = publish(fixture());
    const history = JSON.parse(p.historyText);
    history[0].exchanges.alpha.flagged = 0;
    expect(replay(p.inputsText, p.snapshotText, JSON.stringify(history))).toContainEqual(expect.stringMatching(/^history/));
  });
});

function fixtureSnapshotShell(): Snapshot {
  const p = publish(fixture());
  return JSON.parse(p.snapshotText);
}

describe("receipts", () => {
  const inputs = fixture();
  const inputsText = JSON.stringify(inputs);
  const hash = sha256(inputsText);

  it("replays and links to the full inputs", () => {
    const r = makeReceipt(inputs, hash, "alpha")!;
    expect(Object.keys(r.tokens).sort()).toEqual(["1", "2", "3"]);
    expect(replayReceipt(JSON.parse(JSON.stringify(r)), inputsText)).toEqual({ problems: [], linked: true });
    expect(replayReceipt(JSON.parse(JSON.stringify(r)))).toEqual({ problems: [], linked: false });
  });

  it("has no receipt for an exchange without wallets", () => {
    expect(makeReceipt(inputs, hash, "gamma")).toBeNull();
  });

  it("fails when the result is edited", () => {
    const r = JSON.parse(JSON.stringify(makeReceipt(inputs, hash, "alpha")));
    r.result.excessUsd = 0;
    expect(replayReceipt(r).problems.length).toBeGreaterThan(0);
  });

  it("fails when a row is edited", () => {
    const r = JSON.parse(JSON.stringify(makeReceipt(inputs, hash, "alpha")));
    r.source.assets[1].balance = 1;
    expect(replayReceipt(r).problems.length).toBeGreaterThan(0);
  });

  it("catches a self-consistent forgery once the full inputs are present", () => {
    const forged = fixture();
    forged.exchanges[0].assets[1].balance = 1;
    const r = makeReceipt(forged, hash, "alpha")!;
    expect(replayReceipt(JSON.parse(JSON.stringify(r))).problems).toEqual([]);
    const linked = replayReceipt(JSON.parse(JSON.stringify(r)), inputsText);
    expect(linked.linked).toBe(true);
    expect(linked.problems.length).toBeGreaterThan(0);
  });
});

describe.runIf(existsSync("data/inputs.json"))("replay of the shipped data", () => {
  it("rebuilds data/snapshot.json exactly from data/inputs.json", () => {
    const read = (p: string) => readFileSync(p, "utf8");
    expect(replay(read("data/inputs.json"), read("data/snapshot.json"), read("data/history.json"))).toEqual([]);
  });
});
