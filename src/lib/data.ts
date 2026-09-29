import "server-only";
import snapshotJson from "../../data/snapshot.json";
import historyJson from "../../data/history.json";
import type { CardExchange, CardRefusal } from "@/components/exchange-card";
import type { HistoryPoint, Snapshot, SnapshotExchange } from "./snapshot";

export const snapshot = snapshotJson as unknown as Snapshot;
export const history = historyJson as unknown as HistoryPoint[];

export const flaggedUsd = (e: SnapshotExchange) => e.reportedUsd - e.backedUsd;

export function getExchange(slug: string) {
  return snapshot.exchanges.find((e) => e.slug === slug);
}

export function summary() {
  const xs = snapshot.exchanges;
  const reported = xs.reduce((n, e) => n + e.reportedUsd, 0);
  const flagged = xs.reduce((n, e) => n + flaggedUsd(e), 0);
  const withCover = xs.filter((e) => e.cover != null);
  const overOne = withCover.filter((e) => e.cover! > 1);
  const overTen = withCover.filter((e) => e.cover! > 10);
  const sum = (ys: SnapshotExchange[], pick: (e: SnapshotExchange) => number) => ys.reduce((n, e) => n + pick(e), 0);

  return {
    exchanges: xs.length,
    reported,
    flagged,
    flaggedExchanges: xs.filter((e) => e.reportedUsd > 0 && flaggedUsd(e) / e.reportedUsd >= 0.05).length,
    withCover: withCover.length,
    overOne: {
      count: overOne.length,
      openInterest: sum(overOne, (e) => e.openInterestUsd ?? 0),
      reserves: sum(overOne, (e) => e.reportedUsd),
      withoutLiquidations: overOne.filter((e) => !e.reportsLiquidations).length,
    },
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
    backed: e.backedUsd,
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
