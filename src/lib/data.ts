import "server-only";
import snapshotJson from "../../data/snapshot.json";
import historyJson from "../../data/history.json";
import verifyJson from "../../data/verify.json";
import type { CardExchange, CardRefusal } from "@/components/exchange-card";
import { METHOD_VERSION } from "./checks";
import type { HistoryPoint, Snapshot, SnapshotExchange } from "./snapshot";

export const snapshot = snapshotJson as unknown as Snapshot;
export const history = historyJson as unknown as HistoryPoint[];

type Verification = {
  at: string;
  snapshotAt: string;
  methodVersion: string;
  tolerance: number;
  passed: boolean;
  maxDiff: number;
  results: { slug: string }[];
};

const verify = verifyJson as unknown as Partial<Verification>;

// A verification only counts if it ran against this exact snapshot and method.
export const verification =
  verify.passed === true && verify.snapshotAt === snapshot.generatedAt && verify.methodVersion === METHOD_VERSION
    ? (verify as Verification)
    : null;

export const flaggedUsd = (e: SnapshotExchange) => e.unverifiedUsd + e.thinUsd + e.excessUsd;

export function getExchange(slug: string) {
  return snapshot.exchanges.find((e) => e.slug === slug);
}

export function summary() {
  const xs = snapshot.exchanges;
  const sum = (ys: SnapshotExchange[], pick: (e: SnapshotExchange) => number) => ys.reduce((n, e) => n + pick(e), 0);
  const withCover = xs.filter((e) => e.cover != null);
  const overOne = withCover.filter((e) => e.cover! > 1);
  const overTen = withCover.filter((e) => e.cover! > 10);

  return {
    exchanges: xs.length,
    reported: sum(xs, (e) => e.reportedUsd),
    flagged: sum(xs, flaggedUsd),
    exempt: sum(xs, (e) => e.exemptUsd),
    withCover: withCover.length,
    overOne: {
      count: overOne.length,
      withLiquidationData: overOne.filter((e) => e.reportsLiquidations).length,
    },
    liquidationData: xs.filter((e) => e.reportsLiquidations).length,
    largestFlag: largestFlag(),
    overTen: {
      count: overTen.length,
      openInterest: sum(overTen, (e) => e.openInterestUsd ?? 0),
      reserves: sum(overTen, (e) => e.reportedUsd),
    },
  };
}

export function callsFor(e: SnapshotExchange) {
  const ids = new Set(e.holdings.map((h) => String(h.cryptoId)));
  return snapshot.calls.filter((c) => {
    if (c.path === "/v1/exchange/assets") return c.params.id === String(e.id);
    if (c.path === "/v1/exchange/info") return c.params.id.split(",").includes(String(e.id));
    if (c.path === "/v2/cryptocurrency/quotes/latest") return c.params.id.split(",").some((id) => ids.has(id));
    return c.path.startsWith("/v5/");
  });
}

export function toCard(e: SnapshotExchange): CardExchange {
  return {
    slug: e.slug,
    name: e.name,
    reported: e.reportedUsd,
    passed: e.passedUsd,
    exempt: e.exemptUsd,
    unverified: e.unverifiedUsd,
    thin: e.thinUsd,
    excess: e.excessUsd,
    cover: e.cover,
    reportsLiquidations: e.reportsLiquidations,
    wallets: e.walletCount,
  };
}

export function refusals(): CardRefusal[] {
  return snapshot.noWallets.map((e) => ({ slug: e.slug, name: e.name, audited: e.porAuditStatus === 1 }));
}

export function callCounts() {
  const counts = new Map<string, { calls: number; credits: number }>();
  for (const c of snapshot.calls) {
    const n = counts.get(c.path) ?? { calls: 0, credits: 0 };
    counts.set(c.path, { calls: n.calls + 1, credits: n.credits + c.credits });
  }
  return [...counts].map(([path, n]) => ({ path, ...n }));
}

function largestFlag() {
  const all = snapshot.exchanges.flatMap((e) => e.holdings.map((h) => ({ exchange: e.name, symbol: h.symbol, usd: h.flaggedUsd })));
  return all.sort((a, b) => b.usd - a.usd)[0];
}
