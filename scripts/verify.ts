import { readFileSync, writeFileSync } from "node:fs";
import { Cmc } from "./cmc";
import { loadKey } from "./key";
import type { Snapshot } from "../src/lib/snapshot";

// Recomputes a few exchanges from fresh API calls without using src/lib/checks.ts,
// so a mistake in the checks cannot hide itself.

const SLUGS = ["lbank", "weex", "mexc", "gate", "binance", "blockfinex", "htx"];
const REDEEMABLE = ["stablecoin", "wrapped-tokens", "liquid-staking-derivatives", "rehypothecated-crypto"];

type Row = { wallet_address: string; balance: number; platform: { crypto_id: number }; currency: { crypto_id: number; price_usd: number | null } };
type Quote = { circulating_supply: number | null; num_market_pairs: number | null; tags: { slug: string }[] | null };

async function main() {
  const snapshot: Snapshot = JSON.parse(readFileSync("data/snapshot.json", "utf8"));
  const cmc = new Cmc(loadKey());
  const results = [];

  for (const slug of SLUGS) {
    const saved = snapshot.exchanges.find((e) => e.slug === slug);
    if (!saved) continue;

    const raw = await cmc.get<Row[]>("/v1/exchange/assets", { id: saved.id });
    const unique = new Map(raw.map((r) => [`${r.wallet_address.toLowerCase()}|${r.platform.crypto_id}|${r.currency.crypto_id}|${r.balance}`, r]));

    const balance = new Map<number, number>();
    const value = new Map<number, number>();
    for (const r of unique.values()) {
      balance.set(r.currency.crypto_id, (balance.get(r.currency.crypto_id) ?? 0) + r.balance);
      value.set(r.currency.crypto_id, (value.get(r.currency.crypto_id) ?? 0) + r.balance * (r.currency.price_usd ?? 0));
    }

    const quotes: Record<string, Quote> = {};
    const ids = [...balance.keys()];
    for (let i = 0; i < ids.length; i += 100) {
      Object.assign(quotes, await cmc.get("/v2/cryptocurrency/quotes/latest", { id: ids.slice(i, i + 100).join(","), skip_invalid: "true" }));
    }

    let reported = 0;
    let flagged = 0;
    for (const [id, usd] of value) {
      reported += usd;
      const q = quotes[String(id)];
      const circ = q?.circulating_supply ?? 0;
      if (!q || circ <= 0) flagged += usd;
      else if ((q.tags ?? []).some((t) => REDEEMABLE.includes(t.slug))) continue;
      else if ((q.num_market_pairs ?? 0) <= 2) flagged += usd;
      else if (balance.get(id)! > circ) flagged += (usd / balance.get(id)!) * (balance.get(id)! - circ);
    }

    const savedFlagged = saved.reportedUsd - saved.backedUsd;
    results.push({
      slug,
      reported: { snapshot: saved.reportedUsd, recomputed: reported, diff: Math.abs(reported - saved.reportedUsd) / saved.reportedUsd },
      flagged: { snapshot: savedFlagged, recomputed: flagged, diff: Math.abs(flagged - savedFlagged) / saved.reportedUsd },
    });
  }

  const maxDiff = Math.max(...results.flatMap((r) => [r.reported.diff, r.flagged.diff]));
  writeFileSync(
    "data/verify.json",
    JSON.stringify({ at: new Date().toISOString(), snapshotAt: snapshot.generatedAt, maxDiff, credits: cmc.credits, results }, null, 2),
  );
  for (const r of results) {
    console.log(`${r.slug.padEnd(12)} reported ${(r.reported.diff * 100).toFixed(3)}%  flagged ${(r.flagged.diff * 100).toFixed(3)}% of reserves`);
  }
  console.log(`max difference ${(maxDiff * 100).toFixed(3)}%, ${cmc.credits} credits`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
