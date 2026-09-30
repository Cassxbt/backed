import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { Cmc } from "./cmc";
import { loadKey } from "./key";
import { buildSnapshot, historyPoint } from "../src/lib/build";
import { METHOD_VERSION } from "../src/lib/checks";
import { type ExchangeSource, type Inputs, sha256, validateInputs } from "../src/lib/inputs";
import { type AssetRow, assetRowProblem } from "../src/lib/rows";
import type { HistoryPoint } from "../src/lib/snapshot";
import type { Token } from "../src/lib/types";

type MapRow = { id: number; slug: string; name: string };
type InfoRow = { id: number; slug: string; name: string; porStatus?: number; porAuditStatus?: number; spot_volume_usd?: number | null };
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
type DerivRow = { exchange_id: string | number; quotes: { open_interest_usd: number | null }[] | null };
type LiqRow = { exchange_id: string | number };

const MAP_LIMIT = 5000;
const DERIV_LIMIT = 500;
const LIQ_PAGE = 250;
const LIQ_MAX_PAGES = 20;

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

function array<T>(x: unknown, what: string): T[] {
  if (!Array.isArray(x)) throw new Error(`${what} is not a list`);
  return x;
}

function record<T>(x: unknown, what: string): Record<string, T> {
  if (typeof x !== "object" || x === null || Array.isArray(x)) throw new Error(`${what} is not an object`);
  return x as Record<string, T>;
}

function amount(x: unknown, what: string): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x !== "number" || !Number.isFinite(x) || x < 0) throw new Error(`${what} is not a non-negative number: ${x}`);
  return x;
}

function assetRow(r: AssetRow, where: string): AssetRow {
  const problem = assetRowProblem(r);
  if (problem) throw new Error(`${where} has a malformed row (${problem}): ${JSON.stringify(r).slice(0, 200)}`);
  return r;
}

// Write every file to a temporary name first, then rename, so a crash never leaves a half-written file behind.
function writeAll(files: Record<string, string>) {
  mkdirSync("data", { recursive: true });
  for (const [path, text] of Object.entries(files)) writeFileSync(`${path}.tmp`, text);
  for (const path of Object.keys(files)) renameSync(`${path}.tmp`, path);
}

async function main() {
  const startedAt = new Date().toISOString();
  const cmc = new Cmc(loadKey());

  const map = array<MapRow>(await cmc.get("/v1/exchange/map", { listing_status: "active", limit: MAP_LIMIT }), "exchange map");
  if (map.length >= MAP_LIMIT) throw new Error("exchange map hit the page limit; results may be truncated");

  const info: InfoRow[] = [];
  for (const ids of chunk(map.map((e) => e.id), 100)) {
    const batch = record<InfoRow>(await cmc.get("/v1/exchange/info", { id: ids.join(",") }), "exchange info");
    for (const id of ids) {
      if (!batch[String(id)]) throw new Error(`exchange info omitted id ${id}, so its reserve status is unknown`);
      info.push(batch[String(id)]);
    }
  }
  const reporting = info.filter((e) => e.porStatus === 1);

  const assets = new Map<number, AssetRow[]>();
  for (const e of reporting) {
    const rows = array<AssetRow>(await cmc.get("/v1/exchange/assets", { id: e.id }), `${e.slug} assets`);
    assets.set(e.id, rows.map((r) => assetRow(r, `${e.slug} assets`)));
  }

  const tokens: Record<string, Token> = {};
  const ids = [...new Set([...assets.values()].flat().map((r) => r.currency.crypto_id))].sort((a, b) => a - b);
  for (const batch of chunk(ids, 100)) {
    const rows = record<QuoteRow>(await cmc.get("/v2/cryptocurrency/quotes/latest", { id: batch.join(","), skip_invalid: "true" }), "quotes");
    for (const q of Object.values(rows)) {
      const usd = q?.quote?.USD;
      if (!Number.isInteger(q?.id) || !usd) throw new Error(`malformed quote: ${JSON.stringify(q).slice(0, 200)}`);
      tokens[String(q.id)] = {
        id: q.id,
        symbol: q.symbol,
        name: q.name,
        price: amount(usd.price, `${q.symbol} price`),
        circulatingSupply: amount(q.circulating_supply, `${q.symbol} circulating supply`),
        totalSupply: amount(q.total_supply, `${q.symbol} total supply`),
        selfReportedCirculatingSupply: amount(q.self_reported_circulating_supply, `${q.symbol} self-reported supply`),
        marketCap: amount(usd.market_cap, `${q.symbol} market cap`),
        volume24h: amount(usd.volume_24h, `${q.symbol} volume`),
        marketPairs: amount(q.num_market_pairs, `${q.symbol} market pairs`),
        tags: array<{ slug: string }>(q.tags ?? [], `${q.symbol} tags`).map((t) => t.slug),
      };
    }
    // A dropped id would otherwise read as "no verified supply" and be flagged, so a gap stops the run instead.
    const missing = batch.filter((id) => !tokens[String(id)]);
    if (missing.length > 0) throw new Error(`quotes omitted ${missing.length} held tokens: ${missing.slice(0, 10).join(", ")}`);
  }

  const deriv = array<DerivRow>(
    record<unknown>(await cmc.get("/v5/exchange/derivatives/list", { limit: DERIV_LIMIT }), "derivatives list").exchanges,
    "derivatives list",
  );
  if (deriv.length >= DERIV_LIMIT) throw new Error("derivatives list hit the page limit; open interest may be missing");
  const openInterest = new Map(
    deriv.map((d) => [Number(d.exchange_id), amount(Array.isArray(d.quotes) ? d.quotes[0]?.open_interest_usd : null, `exchange ${d.exchange_id} open interest`)]),
  );

  // The liquidation list omits exchanges without an integrated feed and those with no liquidations, so absence is not evidence of either.
  const liquidating = new Set<number>();
  for (let page = 0, more = true; more; page++) {
    if (page === LIQ_MAX_PAGES) throw new Error("liquidation list did not end within the page cap");
    const body = record<unknown>(
      await cmc.get("/v5/derivatives/liquidations/exchange/list/latest", { start: page * LIQ_PAGE + 1, limit: LIQ_PAGE }),
      "liquidation list",
    );
    array<LiqRow>(body.exchanges, "liquidation list").forEach((l) => liquidating.add(Number(l.exchange_id)));
    if (typeof body.has_more !== "boolean") throw new Error("liquidation list has no has_more flag");
    more = body.has_more;
  }

  const exchanges: ExchangeSource[] = reporting.map((e) => ({
    id: e.id,
    slug: e.slug,
    name: e.name,
    porAuditStatus: e.porAuditStatus ?? 0,
    spotVolumeUsd: amount(e.spot_volume_usd, `${e.slug} spot volume`),
    openInterestReported: openInterest.get(e.id) ?? null,
    inLiquidationResponse: liquidating.has(e.id),
    assets: assets.get(e.id)!,
  }));

  const inputs: Inputs = {
    methodVersion: METHOD_VERSION,
    startedAt,
    capturedAt: new Date().toISOString(),
    exchangesListed: map.length,
    exchanges,
    tokens,
    calls: cmc.calls,
  };
  const problems = validateInputs(inputs);
  if (problems.length > 0) throw new Error(problems.join("; "));

  const inputsText = JSON.stringify(inputs);
  const snapshot = buildSnapshot(inputs, sha256(inputsText));

  const historyPath = "data/history.json";
  const history: HistoryPoint[] = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath, "utf8")) : [];
  history.push(historyPoint(snapshot));

  writeAll({
    "data/inputs.json": inputsText,
    "data/snapshot.json": JSON.stringify(snapshot),
    [historyPath]: JSON.stringify(history),
  });

  console.log(
    `${snapshot.exchanges.length} exchanges, ${Object.keys(tokens).length} tokens, ${cmc.calls.length} calls, ${cmc.credits} credits, inputs ${snapshot.inputsSha256.slice(0, 12)}`,
  );
}

main().catch((err) => {
  console.error(`snapshot not written: ${err.message}`);
  process.exit(1);
});
