import { METHOD_VERSION, checkExchange } from "./checks";
import type { ExchangeSource, Inputs } from "./inputs";
import { normalizeRows, walletKey } from "./rows";
import type { HistoryPoint, Snapshot, SnapshotExchange, WalletRow } from "./snapshot";
import type { Holding, Token } from "./types";

const ROWS_PER_FLAG = 5;

export const tokenMap = (tokens: Record<string, Token>) => new Map(Object.values(tokens).map((t) => [t.id, t]));

export function buildExchange(src: ExchangeSource, tokens: Map<number, Token>): SnapshotExchange {
  const { rows, duplicates, conflicts } = normalizeRows(src.assets);

  const byToken = new Map<number, { h: Holding; wallets: Set<string>; rows: WalletRow[] }>();
  let unpricedRows = 0;
  for (const r of rows) {
    if (r.currency.price_usd == null) unpricedRows++;
    const id = r.currency.crypto_id;
    const entry = byToken.get(id) ?? {
      h: { cryptoId: id, symbol: r.currency.symbol, balance: 0, usd: 0, wallets: 0, chains: [] },
      wallets: new Set<string>(),
      rows: [],
    };
    entry.h.balance += r.balance;
    entry.h.usd += r.balance * (r.currency.price_usd ?? 0);
    const chain = r.platform.symbol && r.platform.symbol !== "-" ? r.platform.symbol : r.platform.name;
    entry.wallets.add(walletKey(r.wallet_address));
    if (!entry.h.chains.includes(chain)) entry.h.chains.push(chain);
    entry.rows.push({ address: r.wallet_address, chain, balance: r.balance });
    byToken.set(id, entry);
  }

  const result = checkExchange(
    {
      id: src.id,
      slug: src.slug,
      name: src.name,
      porAuditStatus: src.porAuditStatus,
      spotVolumeUsd: src.spotVolumeUsd,
      openInterestReported: src.openInterestReported,
      inLiquidationResponse: src.inLiquidationResponse,
      walletCount: new Set(rows.map((r) => walletKey(r.wallet_address))).size,
      duplicateRowsRemoved: duplicates,
      conflictingRows: conflicts,
      holdings: [...byToken.values()].map((v) => ({ ...v.h, wallets: v.wallets.size })),
    },
    tokens,
  );

  return {
    ...result,
    holdings: result.holdings.map((h) =>
      h.flag ? { ...h, rows: byToken.get(h.cryptoId)!.rows.sort((a, b) => b.balance - a.balance).slice(0, ROWS_PER_FLAG) } : h,
    ),
    unpricedRows,
  };
}

export function buildSnapshot(inputs: Inputs, inputsSha256: string): Snapshot {
  const tokens = tokenMap(inputs.tokens);
  const exchanges: SnapshotExchange[] = [];
  const noWallets: Snapshot["noWallets"] = [];

  for (const src of inputs.exchanges) {
    if (src.assets.length === 0) noWallets.push({ slug: src.slug, name: src.name, porAuditStatus: src.porAuditStatus });
    else exchanges.push(buildExchange(src, tokens));
  }
  exchanges.sort((a, b) => b.reportedUsd - a.reportedUsd || a.id - b.id);

  return {
    methodVersion: METHOD_VERSION,
    inputsSha256,
    startedAt: inputs.startedAt,
    generatedAt: inputs.capturedAt,
    credits: inputs.calls.reduce((n, c) => n + c.credits, 0),
    exchangesListed: inputs.exchangesListed,
    porReporting: inputs.exchanges.length,
    exchanges,
    noWallets,
    tokens: inputs.tokens,
    calls: inputs.calls,
  };
}

export function historyPoint(s: Snapshot): HistoryPoint {
  return {
    at: s.generatedAt,
    methodVersion: s.methodVersion,
    exchanges: Object.fromEntries(
      s.exchanges.map((x) => [
        x.slug,
        { reported: x.reportedUsd, flagged: x.unverifiedUsd + x.thinUsd + x.excessUsd, exempt: x.exemptUsd, cover: x.cover },
      ]),
    ),
  };
}

export type Receipt = {
  receipt: "backed-exchange-v1";
  methodVersion: string;
  inputsSha256: string;
  capturedAt: string;
  source: ExchangeSource;
  tokens: Record<string, Token>;
  result: SnapshotExchange;
};

// One exchange's raw CMC rows, the token data they were checked against, and the published result.
export function makeReceipt(inputs: Inputs, inputsSha256: string, slug: string): Receipt | null {
  const source = inputs.exchanges.find((e) => e.slug === slug);
  if (!source || source.assets.length === 0) return null;
  const ids = new Set(source.assets.map((r) => String(r.currency.crypto_id)));
  const tokens = Object.fromEntries(Object.entries(inputs.tokens).filter(([id]) => ids.has(id)));
  return {
    receipt: "backed-exchange-v1",
    methodVersion: METHOD_VERSION,
    inputsSha256,
    capturedAt: inputs.capturedAt,
    source,
    tokens,
    result: buildExchange(source, tokenMap(inputs.tokens)),
  };
}
