import { describe, expect, it } from "vitest";
import { checkExchange, classifyHolding, THIN_MARKET_PAIRS } from "./checks";
import type { ExchangeInput, Holding, Token } from "./types";

const token = (over: Partial<Token>): Token => ({
  id: 1,
  symbol: "TKN",
  name: "Token",
  price: 1,
  circulatingSupply: 1_000_000,
  totalSupply: 2_000_000,
  selfReportedCirculatingSupply: null,
  marketCap: 1_000_000,
  volume24h: 100_000,
  marketPairs: 50,
  tags: [],
  ...over,
});

const holding = (over: Partial<Holding>): Holding => ({
  cryptoId: 1,
  symbol: "TKN",
  balance: 1000,
  usd: 1000,
  wallets: 1,
  chains: ["ETH"],
  ...over,
});

describe("classifyHolding", () => {
  it("leaves a liquid, verified holding unflagged", () => {
    const r = classifyHolding(holding({}), token({}));
    expect(r.flag).toBeNull();
    expect(r.flaggedUsd).toBe(0);
    expect(r.daysOfVolume).toBeCloseTo(0.01);
  });

  it("flags the whole holding when CMC has no verified circulating supply", () => {
    const umm = token({ circulatingSupply: 0, selfReportedCirculatingSupply: 1e8, marketCap: 0, marketPairs: 1 });
    const r = classifyHolding(holding({ balance: 98_900_000, usd: 397e6 }), umm);
    expect(r.flag).toBe("unverified");
    expect(r.flaggedUsd).toBe(397e6);
    expect(r.shareOfCirculating).toBeNull();
  });

  it("treats a token CMC does not return as unverified", () => {
    const r = classifyHolding(holding({ usd: 500 }), undefined);
    expect(r.flag).toBe("unverified");
    expect(r.flaggedUsd).toBe(500);
  });

  it("flags a thin market when pairs are at or below the threshold", () => {
    const r = classifyHolding(holding({ usd: 700 }), token({ marketPairs: THIN_MARKET_PAIRS }));
    expect(r.flag).toBe("thin");
    expect(r.flaggedUsd).toBe(700);
  });

  it("flags only the portion above circulating supply", () => {
    const gt = token({ circulatingSupply: 100, totalSupply: 140, price: 10 });
    const r = classifyHolding(holding({ balance: 150, usd: 1500 }), gt);
    expect(r.flag).toBe("excess");
    expect(r.flaggedUsd).toBeCloseTo(500);
    expect(r.shareOfCirculating).toBeCloseTo(1.5);
    expect(r.shareOfTotal).toBeCloseTo(150 / 140);
  });

  it("prefers unverified over thin over excess", () => {
    const r = classifyHolding(holding({ balance: 5e6 }), token({ circulatingSupply: 0, marketPairs: 1 }));
    expect(r.flag).toBe("unverified");
  });

  it("does not report days of volume for redeemable assets", () => {
    const wbeth = token({ tags: ["liquid-staking-derivatives"], volume24h: 1 });
    const r = classifyHolding(holding({ usd: 9.7e9 }), wbeth);
    expect(r.redeemable).toBe(true);
    expect(r.daysOfVolume).toBeNull();
    expect(r.flag).toBeNull();
  });
});

describe("checkExchange", () => {
  const tokens = new Map<number, Token>([
    [1, token({ id: 1 })],
    [2, token({ id: 2, circulatingSupply: 0 })],
    [3, token({ id: 3, circulatingSupply: 100, price: 2 })],
  ]);
  const input: ExchangeInput = {
    id: 99,
    slug: "demo",
    name: "Demo",
    porAuditStatus: 0,
    spotVolumeUsd: 1e6,
    openInterestUsd: 5000,
    reportsLiquidations: false,
    duplicateRowsRemoved: 0,
    walletCount: 3,
    holdings: [
      holding({ cryptoId: 1, usd: 1000, chains: ["ETH"] }),
      holding({ cryptoId: 2, usd: 300, wallets: 2, chains: ["BSC"] }),
      holding({ cryptoId: 3, balance: 150, usd: 300, chains: ["ETH"] }),
    ],
  };

  it("subtracts flagged value from reported value", () => {
    const r = checkExchange(input, tokens);
    expect(r.reportedUsd).toBe(1600);
    expect(r.unverifiedUsd).toBe(300);
    expect(r.excessUsd).toBeCloseTo(100);
    expect(r.backedUsd).toBeCloseTo(1200);
    expect(r.backedShare).toBeCloseTo(0.75);
  });

  it("computes cover as open interest over reported reserves", () => {
    expect(checkExchange(input, tokens).cover).toBeCloseTo(5000 / 1600);
  });

  it("returns null cover when open interest is unknown", () => {
    expect(checkExchange({ ...input, openInterestUsd: null }, tokens).cover).toBeNull();
  });

  it("passes distinct wallet count through and lists distinct chains", () => {
    const r = checkExchange(input, tokens);
    expect(r.walletCount).toBe(3);
    expect(r.chains).toEqual(["BSC", "ETH"]);
  });

  it("orders holdings by value", () => {
    expect(checkExchange(input, tokens).holdings.map((h) => h.cryptoId)).toEqual([1, 2, 3]);
  });

  it("handles an exchange with no priced holdings", () => {
    const r = checkExchange({ ...input, holdings: [] }, tokens);
    expect(r.reportedUsd).toBe(0);
    expect(r.backedShare).toBe(0);
    expect(r.cover).toBeNull();
  });
});
