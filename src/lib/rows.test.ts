import { describe, expect, it } from "vitest";
import { type AssetRow, normalizeRows, walletKey } from "./rows";

const row = (over: Partial<AssetRow> & { address?: string; token?: number; price?: number | null }): AssetRow => ({
  wallet_address: over.address ?? "0xAbC0000000000000000000000000000000000001",
  balance: over.balance ?? 10,
  platform: { crypto_id: 1027, symbol: "ETH", name: "Ethereum" },
  currency: { crypto_id: over.token ?? 1, symbol: "TKN", price_usd: over.price === undefined ? 2 : over.price },
});

describe("walletKey", () => {
  it("folds case for EVM addresses only", () => {
    expect(walletKey("0xAbC0000000000000000000000000000000000001")).toBe("0xabc0000000000000000000000000000000000001");
    expect(walletKey("3FJ9hqurtzy7pcqkhjebgrdcy3fjbhhyxd")).toBe("3FJ9hqurtzy7pcqkhjebgrdcy3fjbhhyxd");
  });
});

describe("normalizeRows", () => {
  it("drops exact duplicates, including EVM case variants", () => {
    const r = normalizeRows([row({}), row({ address: "0xabc0000000000000000000000000000000000001" })]);
    expect(r.rows).toHaveLength(1);
    expect(r.duplicates).toBe(1);
    expect(r.conflicts).toBe(0);
  });

  it("keeps case-sensitive addresses distinct", () => {
    const r = normalizeRows([row({ address: "3FJ9abc" }), row({ address: "3fj9abc" })]);
    expect(r.rows).toHaveLength(2);
  });

  it("keeps one row for conflicting balances and counts the conflict", () => {
    const r = normalizeRows([row({ balance: 5 }), row({ balance: 8 })]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].balance).toBe(8);
    expect(r.conflicts).toBe(1);
  });

  it("treats a different price for the same balance as a conflict, whatever the row order", () => {
    for (const prices of [[1, 10], [10, 1], [null, 10], [10, null]]) {
      const r = normalizeRows(prices.map((p) => row({ balance: 100, price: p })));
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].currency.price_usd).toBe(10);
      expect(r.conflicts).toBe(1);
      expect(r.duplicates).toBe(0);
    }
  });

  it("gives the same result for any permutation of the rows", () => {
    const rows = [row({ balance: 5 }), row({ balance: 8, price: 3 }), row({ balance: 8, price: 2 }), row({ token: 2 }), row({ balance: 5 })];
    const pick = (rs: AssetRow[]) => {
      const n = normalizeRows(rs);
      return JSON.stringify([n.rows.map((x) => [x.currency.crypto_id, x.balance, x.currency.price_usd]).sort(), n.conflicts + n.duplicates]);
    };
    const expected = pick(rows);
    for (let i = 0; i < 20; i++) {
      const shuffled = [...rows].sort(() => (Math.sin(i * 7919 + rows.length) > 0 ? 1 : -1));
      expect(pick(shuffled)).toBe(expected);
    }
    expect(pick([...rows].reverse())).toBe(expected);
  });

  it("keeps different tokens in the same wallet", () => {
    expect(normalizeRows([row({ token: 1 }), row({ token: 2 })]).rows).toHaveLength(2);
  });

  it("rejects negative or non-finite numbers", () => {
    expect(() => normalizeRows([row({ balance: -1 })])).toThrow();
    expect(() => normalizeRows([row({ balance: Number.NaN })])).toThrow();
    expect(() => normalizeRows([row({ price: Number.POSITIVE_INFINITY })])).toThrow();
  });

  it("allows a missing price", () => {
    expect(normalizeRows([row({ price: null })]).rows).toHaveLength(1);
  });
});
