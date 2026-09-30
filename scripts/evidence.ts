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
  quotes: { open_interest: number | null }[];
};

async function main() {
  const cmc = new Cmc(loadKey());
  const stamp = () => new Date().toISOString();

  const binance = await cmc.get<AssetRow[]>("/v1/exchange/assets", { id: 270 });
  const btc = binance.filter((r) => r.platform.symbol === "BTC").map((r) => r.wallet_address);
  const legacy = btc.filter((a) => !a.startsWith("bc1"));
  const btcAddresses = {
    call: "GET /v1/exchange/assets?id=270",
    at: stamp(),
    btcRows: btc.length,
    legacy: legacy.length,
    lowercased: legacy.filter((a) => a === a.toLowerCase() && /[a-z]/.test(a)).length,
  };

  const deriv = await cmc.get<{ exchanges: DerivExchange[] }>("/v5/exchange/derivatives/list", { limit: 500 });
  const zero = deriv.exchanges
    .filter((d) => d.quotes?.[0]?.open_interest_usd === 0)
    .map((d) => ({ slug: d.exchange_slug, name: d.exchange_name, derivativeVolumeUsd: d.quotes[0].derivative_volume_usd ?? 0 }))
    .sort((a, b) => b.derivativeVolumeUsd - a.derivativeVolumeUsd);
  const zeroOpenInterest = { call: "GET /v5/exchange/derivatives/list?limit=500", at: stamp(), exchanges: zero };

  const pairs = await cmc.get<{ market_pairs: Pair[] }>("/v5/cryptocurrency/derivatives/market-pairs/list/latest", { crypto_id: 1, limit: 250 });
  const top = pairs.market_pairs
    .map((p) => ({ p, oi: Math.max(0, ...p.quotes.map((q) => q.open_interest ?? 0)) }))
    .sort((a, b) => b.oi - a.oi)[0];
  const largestPairOpenInterest = {
    call: "GET /v5/cryptocurrency/derivatives/market-pairs/list/latest?crypto_id=1&limit=250",
    at: stamp(),
    exchange: top.p.exchange.exchange_name,
    pair: top.p.market_pair_symbol,
    openInterestUsd: top.oi,
    outlierDetected: top.p.outlier_detected,
    exclusions: top.p.exclusions,
  };

  writeFileSync("data/evidence.json", JSON.stringify({ btcAddresses, zeroOpenInterest, largestPairOpenInterest }, null, 2));
  console.log(`evidence written, ${cmc.credits} credits`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
