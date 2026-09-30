import { checkExchange } from "./checks";
import type { Snapshot, SnapshotExchange } from "./snapshot";
import type { Token } from "./types";

const FIELDS = ["reportedUsd", "passedUsd", "exemptUsd", "unverifiedUsd", "thinUsd", "excessUsd"] as const;

function close(a: number, b: number) {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
}

export function replayExchange(e: SnapshotExchange, tokens: Map<number, Token>): string[] {
  const again = checkExchange(
    {
      ...e,
      holdings: e.holdings.map(({ cryptoId, symbol, balance, usd, wallets, chains }) => ({ cryptoId, symbol, balance, usd, wallets, chains })),
    },
    tokens,
  );
  const problems = FIELDS.filter((f) => !close(e[f], again[f])).map((f) => `${e.slug} ${f}: stored ${e[f]}, replayed ${again[f]}`);

  const parts = e.passedUsd + e.exemptUsd + e.unverifiedUsd + e.thinUsd + e.excessUsd;
  if (!close(parts, e.reportedUsd)) problems.push(`${e.slug} buckets sum to ${parts}, reported ${e.reportedUsd}`);
  return problems;
}

export function replaySnapshot(s: Snapshot): string[] {
  const tokens = new Map(Object.values(s.tokens).map((t) => [t.id, t]));
  return s.exchanges.flatMap((e) => replayExchange(e, tokens));
}
