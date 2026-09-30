import type { Metadata } from "next";
import evidenceJson from "../../../data/evidence.json";
import { Eyebrow } from "@/components/section";
import { flaggedUsd, snapshot } from "@/lib/data";
import { num, pct, usd, utc } from "@/lib/format";

export const metadata: Metadata = { title: "API notes — Backed" };

const evidence = evidenceJson;

const enabled = [
  "Wallet-level proof-of-reserves for every reporting exchange, with price attached, from one endpoint.",
  "Verified circulating supply next to the self-reported figure, which is what makes the unverified-supply check possible.",
  "Open interest per derivatives exchange and a list of who has liquidation data, all on the free Basic plan.",
  "A full refresh of all reporting exchanges costs about 110 credits, thanks to batching 100 exchanges or tokens per call.",
];

type Note = { title: string; body: string; source: string };

function notes(): Note[] {
  const xs = snapshot.exchanges;
  const snap = `Snapshot ${utc(snapshot.generatedAt)}`;
  const audited = snapshot.noWallets.filter((e) => e.porAuditStatus === 1).map((e) => e.name);
  const unverified = xs.reduce((n, e) => n + e.unverifiedUsd, 0);
  const flagged = xs.reduce((n, e) => n + flaggedUsd(e), 0);
  const conflicted = xs.filter((e) => e.conflictingRows > 0).map((e) => e.name);
  const binance = xs.find((e) => e.slug === "binance");
  const usds = binance?.holdings.find((h) => h.cryptoId === 33452);
  const usdsToken = snapshot.tokens["33452"];
  const zero = evidence.zeroOpenInterest.exchanges;
  const pair = evidence.largestPairOpenInterest;
  const btc = evidence.btcAddresses;

  const list: (Note | null)[] = [
    audited.length > 0
      ? {
          title: "Audited exchanges return no wallets",
          body: `Every exchange with porAuditStatus = 1 (${audited.join(", ")}) returns an empty list from exchange/assets, so the exchanges CoinMarketCap marks as audited are the ones whose wallets the API cannot show.`,
          source: `${snap} · GET /v1/exchange/info, /v1/exchange/assets`,
        }
      : null,
    {
      title: "Reserve totals count unverified tokens at full price",
      body: `exchange/assets prices every token, including ones for which quotes/latest withholds circulating supply and market cap. ${usd(unverified)} of the ${usd(flagged)} Backed flags, ${pct(unverified / flagged, 0)}, comes from this.`,
      source: `${snap} · GET /v1/exchange/assets, /v2/cryptocurrency/quotes/latest`,
    },
    usds && usdsToken?.circulatingSupply
      ? {
          title: "A reserve balance is mapped to the wrong token",
          body: `Binance's USDS rows carry crypto_id 33452 (${usdsToken.name}, about ${num(usdsToken.circulatingSupply)} circulating). The balance is ${num(usds.balance / usdsToken.circulatingSupply)} times that token's supply, which points to USDS (id 33039). One possible cause is matching by symbol alone.`,
          source: `${snap} · GET /v1/exchange/assets?id=270`,
        }
      : null,
    {
      title: "No timestamp on reserve rows",
      body: "The documentation says balances may be delayed and only wallets holding at least $100,000 are shown. Rows contain wallet_address, balance, platform and currency only, so there is no way to tell how old a balance is or to line it up with the price it is multiplied by.",
      source: "CoinMarketCap exchange API documentation",
    },
    {
      title: "Wallet addresses lose their case",
      body: `${btc.lowercased} of Binance's ${btc.legacy} legacy Bitcoin addresses are returned in lowercase. Base58 addresses are case-sensitive, so these cannot be looked up on-chain as returned.`,
      source: `${utc(btc.at)} · ${btc.call}`,
    },
    {
      title: "Duplicate and conflicting reserve rows",
      body: `Responses repeat the same wallet, token and balance, sometimes with the address in a different letter case. Some wallet and token pairs also come back with two different balances${
        conflicted.length ? ` (${conflicted.join(", ")} in this snapshot)` : ""
      }, and nothing marks which is current. Backed drops exact duplicates, keeps the larger of conflicting balances, and counts both.`,
      source: `${snap} · GET /v1/exchange/assets`,
    },
    zero.length > 0
      ? {
          title: "Open interest of zero where trading is heavy",
          body: `open_interest_usd is exactly 0 for ${zero.length} derivatives exchanges, including ${zero[0].name} with ${usd(zero[0].derivativeVolumeUsd)} of 24h derivatives volume in the same response. Which exchanges show zero changes between refreshes. Backed treats zero as missing data. A null, or a flag for unavailable data, would remove the ambiguity.`,
          source: `${utc(evidence.zeroOpenInterest.at)} · ${evidence.zeroOpenInterest.call}`,
        }
      : null,
    {
      title: "Open interest outliers are not flagged",
      body: `In derivatives market pairs for BTC, ${pair.exchange} ${pair.pair} reports ${usd(pair.openInterestUsd)} of open interest, more than the whole crypto market. outlier_detected is ${pair.outlierDetected}, and the pair's exclusions list (${pair.exclusions.join(", ")}) does not include open interest.`,
      source: `${utc(pair.at)} · ${pair.call}`,
    },
    {
      title: "Funding rates have no interval",
      body: "funding_rate is returned without its settlement interval, so rates cannot be compared across exchanges that settle hourly, every 4 hours or every 8 hours.",
      source: "GET /v5/cryptocurrency/derivatives/market-pairs/list/latest",
    },
    {
      title: "Market depth is off the Basic plan",
      body: "market-pairs/latest would let the thin-market check use real depth instead of a pair count, but it returns 403 (error 1006) on the Basic plan. Most API users are on that plan.",
      source: "GET /v2/cryptocurrency/market-pairs/latest on a Basic key",
    },
  ];
  return list.filter((n): n is Note => n !== null);
}

export default function ApiNotesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <Eyebrow>Feedback for CoinMarketCap</Eyebrow>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-tight sm:text-6xl">API notes</h1>
      <p className="mt-6 text-lg text-pretty text-muted-foreground">
        What the CoinMarketCap API made possible, and where it got in the way. Every item was reproduced against the live
        API, and each lists the call and time it comes from. <code className="font-mono text-sm">npm run evidence</code>{" "}
        recaptures the live ones.
      </p>

      <h2 className="mt-14 font-display text-3xl tracking-tight">What it made possible</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        {enabled.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <h2 className="mt-14 font-display text-3xl tracking-tight">Where it got in the way</h2>
      <ol className="mt-4 space-y-6">
        {notes().map((f, i) => (
          <li key={f.title} className="grid gap-1 sm:grid-cols-[2rem_1fr]">
            <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>
            <div>
              <h3 className="text-sm font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">{f.body}</p>
              <p className="mt-1.5 break-all font-mono text-[11px] text-muted-foreground">{f.source}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
