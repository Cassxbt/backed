import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { Cmc } from "./cmc";
import { loadKey } from "./key";

// Captures the minimal reproductions behind the API notes page, with the exact call and time of each.

type AssetRow = { wallet_address: string; platform: { symbol: string } };
type DerivExchange = { exchange_slug: string; exchange_name: string; quotes: { open_interest_usd: number | null; derivative_volume_usd: number | null }[] };
type Pair = {
  market_pair_symbol: string;
  outlier_detected: boolean;
  exclusions: string[];
  exchange: { exchange_slug: string; exchange_name: string };
  quotes: Record<string, unknown>[];
  exchange_reported_quotes?: Record<string, unknown>[];
} & Record<string, unknown>;

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function isBase58Check(address: string): boolean {
  let n = BigInt(0);
  for (const c of address) {
    const i = BASE58.indexOf(c);
    if (i < 0) return false;
    n = n * BigInt(58) + BigInt(i);
  }
  const hex = n.toString(16).padStart(2, "0");
  const body = Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex");
  const zeros = address.match(/^1*/)![0].length;
  const bytes = Buffer.concat([Buffer.alloc(zeros), body]);
  if (bytes.length < 5) return false;
  const payload = bytes.subarray(0, -4);
  const check = createHash("sha256").update(createHash("sha256").update(payload).digest()).digest().subarray(0, 4);
  return check.equals(bytes.subarray(-4));
}

async function planProbe(key: string, path: string) {
  const res = await fetch(`https://pro-api.coinmarketcap.com${path}`, { headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" } });
  const body = await res.json().catch(() => ({}));
  return {
    call: `GET ${path}`,
    at: new Date().toISOString(),
    httpStatus: res.status,
    errorCode: body.status?.error_code ?? null,
    errorMessage: body.status?.error_message ?? null,
  };
}

async function main() {
  const key = loadKey();
  const cmc = new Cmc(key);
  const stamp = () => new Date().toISOString();

  const binance = await cmc.get<AssetRow[]>("/v1/exchange/assets", { id: 270 });
  const legacy = binance.filter((r) => r.platform.symbol === "BTC" && !r.wallet_address.startsWith("bc1")).map((r) => r.wallet_address);
  const lower = legacy.filter((a) => a === a.toLowerCase());
  const btcAddresses = {
    call: "GET /v1/exchange/assets?id=270",
    at: stamp(),
    legacy: legacy.length,
    allLowercase: lower.length,
    failChecksum: legacy.filter((a) => !isBase58Check(a)).length,
    allLowercaseFailChecksum: lower.filter((a) => !isBase58Check(a)).length,
    mixedCaseFailChecksum: legacy.filter((a) => a !== a.toLowerCase() && !isBase58Check(a)).length,
  };

  const deriv = await cmc.get<{ exchanges: DerivExchange[] }>("/v5/exchange/derivatives/list", { limit: 500 });
  const zero = deriv.exchanges
    .filter((d) => d.quotes?.[0]?.open_interest_usd === 0)
    .map((d) => ({ slug: d.exchange_slug, name: d.exchange_name, derivativeVolumeUsd: d.quotes[0].derivative_volume_usd ?? 0 }))
    .sort((a, b) => b.derivativeVolumeUsd - a.derivativeVolumeUsd);
  const zeroOpenInterest = { call: "GET /v5/exchange/derivatives/list?limit=500", at: stamp(), exchanges: zero };

  const pairsCall = "/v5/cryptocurrency/derivatives/market-pairs/list/latest";
  const pairs = await cmc.get<{ market_pairs: Pair[] }>(pairsCall, { crypto_id: 1, limit: 250 });
  const pairsAt = stamp();
  const oi = (p: Pair) => Math.max(0, ...p.quotes.map((q) => (typeof q.open_interest === "number" ? q.open_interest : 0)));
  const top = pairs.market_pairs.map((p) => ({ p, oi: oi(p) })).sort((a, b) => b.oi - a.oi)[0];

  const global = await cmc.get<{ quote: { USD: { total_market_cap: number } } }>("/v1/global-metrics/quotes/latest");
  const largestPairOpenInterest = {
    call: `GET ${pairsCall}?crypto_id=1&limit=250`,
    at: pairsAt,
    exchange: top.p.exchange.exchange_name,
    pair: top.p.market_pair_symbol,
    openInterestUsd: top.oi,
    outlierDetected: top.p.outlier_detected,
    exclusions: top.p.exclusions,
    totalMarketCapUsd: global.quote.USD.total_market_cap,
    totalMarketCapCall: "GET /v1/global-metrics/quotes/latest",
  };

  const keys = new Set<string>();
  for (const p of pairs.market_pairs) {
    Object.keys(p).forEach((k) => keys.add(k));
    p.quotes.forEach((q) => Object.keys(q).forEach((k) => keys.add(`quotes.${k}`)));
    (p.exchange_reported_quotes ?? []).forEach((q) => Object.keys(q).forEach((k) => keys.add(`exchange_reported_quotes.${k}`)));
  }
  const fields = [...keys].sort();
  const fundingFields = {
    call: `GET ${pairsCall}?crypto_id=1&limit=250`,
    at: pairsAt,
    pairs: pairs.market_pairs.length,
    withFundingRate: pairs.market_pairs.filter((p) => (p.exchange_reported_quotes ?? []).some((q) => typeof q.funding_rate === "number")).length,
    fundingKeys: fields.filter((k) => /funding/i.test(k)),
    intervalKeys: fields.filter((k) => /interval|period|settle/i.test(k)),
  };

  const depth = [
    await planProbe(key, "/v2/cryptocurrency/market-pairs/latest?id=1"),
    await planProbe(key, "/v1/exchange/market-pairs/latest?id=270"),
  ];

  writeFileSync(
    "data/evidence.json",
    JSON.stringify({ btcAddresses, zeroOpenInterest, largestPairOpenInterest, fundingFields, depth }, null, 2),
  );
  console.log(`evidence written, ${cmc.credits} credits`);
}

if (process.argv[1]?.endsWith("evidence.ts")) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
