import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { Cmc } from "./cmc";
import { checkExchange } from "../src/lib/checks";
import type { ExchangeInput, Holding, Token } from "../src/lib/types";
import type { HistoryPoint, Snapshot, SnapshotExchange, WalletRow } from "../src/lib/snapshot";

type MapRow = { id: number; slug: string; name: string };
type InfoRow = { id: number; slug: string; name: string; porStatus?: number; porAuditStatus?: number; spot_volume_usd?: number };
type AssetRow = {
  wallet_address: string;
  balance: number;
  platform: { crypto_id: number; symbol: string; name: string };
  currency: { crypto_id: number; symbol: string; price_usd: number | null };
};
type QuoteRow = {
  id: number;
  symbol: string;
  name: string;
  circulating_supply: number | null;
  total_supply: number | null;
  self_reported_circulating_supply: number | null;
  num_market_pairs: number | null;
  tags: { slug: string }[] | null;
  quote: { USD: { price: number | null; market_cap: number | null; volume_24h: number | null } };
};
type DerivRow = { exchange_id: string | number; quotes: { open_interest_usd: number | null }[] };
type LiqRow = { exchange_id: string | number };

const KEEP_TOP = 40;
const KEEP_FLAGGED_MIN_USD = 10_000;
const ROWS_PER_FLAG = 5;

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

function loadKey() {
  if (process.env.CMC_PRO_API_KEY) return process.env.CMC_PRO_API_KEY;
  if (existsSync(".env.local")) {
    const line = readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith("CMC_PRO_API_KEY="));
    if (line) return line.slice("CMC_PRO_API_KEY=".length).trim();
  }
  return "";
}

async function main() {
  const cmc = new Cmc(loadKey());

  const map = await cmc.get<MapRow[]>("/v1/exchange/map", { listing_status: "active", limit: 5000 });

  const info: InfoRow[] = [];
  for (const ids of chunk(map.map((e) => e.id), 100)) {
    const batch = await cmc.get<Record<string, InfoRow>>("/v1/exchange/info", { id: ids.join(",") });
    info.push(...Object.values(batch));
  }
  const reporting = info.filter((e) => e.porStatus === 1);

  const assets = new Map<number, AssetRow[]>();
  const failures: Snapshot["failures"] = [];
  for (const e of reporting) {
    try {
      assets.set(e.id, (await cmc.get<AssetRow[]>("/v1/exchange/assets", { id: e.id })) ?? []);
    } catch (err) {
      failures.push({ slug: e.slug, error: (err as Error).message });
    }
  }

  const ids = [...new Set([...assets.values()].flat().map((r) => r.currency.crypto_id))];
  const tokens = new Map<number, Token>();
  for (const batch of chunk(ids, 100)) {
    const rows = await cmc.get<Record<string, QuoteRow>>("/v2/cryptocurrency/quotes/latest", { id: batch.join(","), skip_invalid: "true" });
    for (const q of Object.values(rows)) {
      tokens.set(q.id, {
        id: q.id,
        symbol: q.symbol,
        name: q.name,
        price: q.quote.USD.price,
        circulatingSupply: q.circulating_supply,
        totalSupply: q.total_supply,
        selfReportedCirculatingSupply: q.self_reported_circulating_supply,
        marketCap: q.quote.USD.market_cap,
        volume24h: q.quote.USD.volume_24h,
        marketPairs: q.num_market_pairs,
        tags: (q.tags ?? []).map((t) => t.slug),
      });
    }
  }

  const deriv = await cmc.get<{ exchanges: DerivRow[] }>("/v5/exchange/derivatives/list", { limit: 500 });
  const openInterest = new Map(deriv.exchanges.map((d) => [Number(d.exchange_id), d.quotes?.[0]?.open_interest_usd || null]));

  const liquidating = new Set<number>();
  for (let start = 1; ; start += 250) {
    const page = await cmc.get<{ exchanges: LiqRow[]; has_more: boolean }>("/v5/derivatives/liquidations/exchange/list/latest", { start, limit: 250 });
    page.exchanges.forEach((l) => liquidating.add(Number(l.exchange_id)));
    if (!page.has_more) break;
  }

  const exchanges: SnapshotExchange[] = [];
  const noWallets: Snapshot["noWallets"] = [];
  for (const e of reporting) {
    const raw = assets.get(e.id);
    if (!raw) continue;
    if (raw.length === 0) {
      noWallets.push({ slug: e.slug, name: e.name, porAuditStatus: e.porAuditStatus ?? 0 });
      continue;
    }

    const seen = new Set<string>();
    const rows = raw.filter((r) => {
      const k = `${r.wallet_address.toLowerCase()}|${r.platform.crypto_id}|${r.currency.crypto_id}|${r.balance}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

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
      entry.wallets.add(r.wallet_address.toLowerCase());
      if (!entry.h.chains.includes(chain)) entry.h.chains.push(chain);
      entry.rows.push({ address: r.wallet_address, chain, balance: r.balance });
      byToken.set(id, entry);
    }

    const input: ExchangeInput = {
      id: e.id,
      slug: e.slug,
      name: e.name,
      porAuditStatus: e.porAuditStatus ?? 0,
      spotVolumeUsd: e.spot_volume_usd ?? null,
      openInterestUsd: openInterest.get(e.id) ?? null,
      reportsLiquidations: liquidating.has(e.id),
      walletCount: new Set(rows.map((r) => r.wallet_address.toLowerCase())).size,
      duplicateRowsRemoved: raw.length - rows.length,
      holdings: [...byToken.values()].map((v) => ({ ...v.h, wallets: v.wallets.size })),
    };

    const result = checkExchange(input, tokens);
    const kept = result.holdings.filter((h, i) => i < KEEP_TOP || (h.flag && h.flaggedUsd >= KEEP_FLAGGED_MIN_USD));
    const rest = result.holdings.filter((h) => !kept.includes(h));

    exchanges.push({
      ...result,
      holdings: kept.map((h) =>
        h.flag
          ? { ...h, rows: byToken.get(h.cryptoId)!.rows.sort((a, b) => b.balance - a.balance).slice(0, ROWS_PER_FLAG) }
          : h,
      ),
      otherHoldings: {
        count: rest.length,
        usd: rest.reduce((n, h) => n + h.usd, 0),
        flaggedUsd: rest.reduce((n, h) => n + h.flaggedUsd, 0),
      },
      unpricedRows,
    });
  }

  exchanges.sort((a, b) => b.reportedUsd - a.reportedUsd);

  const usedTokens = new Set(exchanges.flatMap((x) => x.holdings.map((h) => h.cryptoId)));
  const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(),
    credits: cmc.credits,
    exchangesListed: map.length,
    porReporting: reporting.length,
    exchanges,
    noWallets,
    tokens: Object.fromEntries([...tokens].filter(([id]) => usedTokens.has(id))),
    calls: cmc.calls,
    failures,
  };

  mkdirSync("data", { recursive: true });
  writeFileSync("data/snapshot.json", JSON.stringify(snapshot));

  const historyPath = "data/history.json";
  const history: HistoryPoint[] = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath, "utf8")) : [];
  history.push({
    at: snapshot.generatedAt,
    exchanges: Object.fromEntries(exchanges.map((x) => [x.slug, { reported: x.reportedUsd, backed: x.backedUsd, cover: x.cover }])),
  });
  writeFileSync(historyPath, JSON.stringify(history));

  console.log(
    `${exchanges.length} exchanges, ${tokens.size} tokens, ${cmc.calls.length} calls, ${cmc.credits} credits, ${failures.length} failures`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
