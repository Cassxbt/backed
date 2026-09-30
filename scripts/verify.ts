import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Cmc } from "./cmc";
import { loadKey } from "./key";
import { METHOD_VERSION } from "../src/lib/checks";
import type { Snapshot } from "../src/lib/snapshot";

// Recomputes a sample of exchanges from fresh API calls without src/lib/checks.ts or src/lib/rows.ts,
// so a mistake there cannot hide itself. Exits non-zero on any missing exchange or a difference above tolerance.

const SLUGS = ["lbank", "weex", "mexc", "gate", "binance", "blockfinex", "htx", "kucoin"];
const REDEEMABLE = ["stablecoin", "wrapped-tokens", "liquid-staking-derivatives", "rehypothecated-crypto"];
const TOLERANCE = 0.01;
const FLOOR_USD = 1_000_000;

type Row = { wallet_address: string; balance: number; platform: { crypto_id: number }; currency: { crypto_id: number; price_usd: number | null } };
type Quote = { circulating_supply: number | null; num_market_pairs: number | null; tags: { slug: string }[] | null };

// Same rule as the snapshot, written separately: identical rows collapse, and for conflicting rows the larger balance wins,
// then the higher price, with a missing price lowest.
function dedupe(raw: Row[]) {
  const kept = new Map<string, Row>();
  for (const r of raw) {
    const address = /^0x[0-9a-f]{40}$/i.test(r.wallet_address) ? r.wallet_address.toLowerCase() : r.wallet_address;
    const key = [address, r.platform.crypto_id, r.currency.crypto_id].join("|");
    const prev = kept.get(key);
    const price = (x: Row) => x.currency.price_usd ?? -1;
    if (!prev || r.balance > prev.balance || (r.balance === prev.balance && price(r) > price(prev))) kept.set(key, r);
  }
  return [...kept.values()];
}

async function main() {
  const snapshotText = readFileSync("data/snapshot.json", "utf8");
  const snapshot: Snapshot = JSON.parse(snapshotText);
  const cmc = new Cmc(loadKey());
  const results = [];
  const problems: string[] = [];

  for (const slug of SLUGS) {
    const saved = snapshot.exchanges.find((e) => e.slug === slug);
    if (!saved) {
      problems.push(`${slug} missing from snapshot`);
      continue;
    }

    const raw = await cmc.get<Row[]>("/v1/exchange/assets", { id: saved.id });
    if (!Array.isArray(raw)) throw new Error(`${slug} assets is not a list`);
    const bad = raw.find(
      (r) =>
        !(Number.isFinite(r?.balance) && r.balance >= 0) ||
        !(r.currency?.price_usd === null || (Number.isFinite(r.currency?.price_usd) && r.currency.price_usd! >= 0)),
    );
    if (bad) throw new Error(`${slug} returned a row with a non-numeric balance or price`);
    const rows = dedupe(raw);
    const balance = new Map<number, number>();
    const value = new Map<number, number>();
    for (const r of rows) {
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
    let exempt = 0;
    for (const [id, usd] of value) {
      reported += usd;
      const q = quotes[String(id)];
      const circ = q?.circulating_supply ?? 0;
      const held = balance.get(id)!;
      if (!q || circ <= 0) flagged += usd;
      else if ((q.tags ?? []).some((t) => REDEEMABLE.includes(t.slug))) exempt += usd;
      else if (q.num_market_pairs != null && q.num_market_pairs <= 2) flagged += usd;
      else if (held > circ) flagged += (usd / held) * (held - circ);
    }

    const savedFlagged = saved.unverifiedUsd + saved.thinUsd + saved.excessUsd;
    // Each figure is compared with itself, so a large error in a small flagged total cannot hide behind total reserves.
    const diff = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), FLOOR_USD);
    const r = {
      slug,
      reported: { snapshot: saved.reportedUsd, recomputed: reported, diff: diff(reported, saved.reportedUsd) },
      flagged: { snapshot: savedFlagged, recomputed: flagged, diff: diff(flagged, savedFlagged) },
      exempt: { snapshot: saved.exemptUsd, recomputed: exempt, diff: diff(exempt, saved.exemptUsd) },
    };
    for (const k of ["reported", "flagged", "exempt"] as const) {
      // Written so that NaN fails: NaN <= x is false.
      if (!(r[k].diff <= TOLERANCE)) problems.push(`${slug} ${k} differs by ${(r[k].diff * 100).toFixed(2)}%`);
    }
    results.push(r);
  }

  const maxDiff = Math.max(0, ...results.flatMap((r) => [r.reported.diff, r.flagged.diff, r.exempt.diff]));
  const passed = problems.length === 0 && results.length === SLUGS.length;
  writeFileSync(
    "data/verify.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        snapshotAt: snapshot.generatedAt,
        snapshotSha256: createHash("sha256").update(snapshotText).digest("hex"),
        inputsSha256: snapshot.inputsSha256,
        methodVersion: METHOD_VERSION,
        tolerance: TOLERANCE,
        floorUsd: FLOOR_USD,
        passed,
        maxDiff,
        problems,
        credits: cmc.credits,
        results,
      },
      null,
      2,
    ),
  );

  for (const r of results) {
    console.log(
      `${r.slug.padEnd(12)} reported ${(r.reported.diff * 100).toFixed(3)}%  flagged ${(r.flagged.diff * 100).toFixed(3)}%  exempt ${(r.exempt.diff * 100).toFixed(3)}%`,
    );
  }
  console.log(`${passed ? "PASS" : "FAIL"} max difference ${(maxDiff * 100).toFixed(3)}%, ${cmc.credits} credits`);
  problems.forEach((p) => console.log(`  ${p}`));
  if (!passed) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
