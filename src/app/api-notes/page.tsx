import type { Metadata } from "next";

export const metadata: Metadata = { title: "API notes — Backed" };

const enabled = [
  "Wallet-level proof-of-reserves for every reporting exchange, with price attached, from one endpoint.",
  "Verified circulating supply next to the self-reported figure, which is what makes the unverified-supply check possible.",
  "Open interest per derivatives exchange and a list of who reports liquidations, all on the free Basic plan.",
  "A full refresh of all reporting exchanges costs about 110 credits, thanks to batching 100 exchanges or tokens per call.",
];

const friction = [
  {
    title: "Audited exchanges return no wallets",
    body: "Every exchange with porAuditStatus = 1 (Kraken, Coinbase, Upbit, Bithumb, Bitvavo, WhiteBIT, Bitso, Coinone) returns an empty list from exchange/assets, so the best-documented reserves are the ones the API cannot show.",
  },
  {
    title: "Reserve totals count unverified tokens at full price",
    body: "exchange/assets prices every token, including ones for which quotes/latest withholds circulating supply and market cap. Most of the gap Backed shows comes from this.",
  },
  {
    title: "A reserve balance is mapped to the wrong token",
    body: "Binance's USDS rows carry crypto_id 33452 (TheStandard USD, about 281K circulating). The balance is 39 times that token's supply, which points to USDS (id 33039). A symbol-only match would explain it.",
  },
  {
    title: "No timestamp on reserve rows",
    body: "Rows contain wallet_address, balance, platform and currency only. There is no way to tell how old a balance is.",
  },
  {
    title: "Wallet addresses lose their case",
    body: "18 of Binance's 29 legacy Bitcoin addresses are returned in lowercase. Base58 addresses are case-sensitive, so these cannot be looked up on-chain as returned.",
  },
  {
    title: "Duplicate reserve rows",
    body: "Gate's response contains duplicate rows: the same wallet, token and balance, sometimes with the address in a different letter case. Backed drops them before summing.",
  },
  {
    title: "Open interest outliers are not flagged",
    body: "In derivatives market pairs for BTC, WOO X Pro BTC/USD reports about $12.7 trillion of open interest, more than the whole crypto market. outlier_detected is false, and the pair's exclusions list covers price and volume but not open interest.",
  },
  {
    title: "Funding rates have no interval",
    body: "funding_rate is returned without its settlement interval, so rates cannot be compared across exchanges that settle hourly, every 4 hours or every 8 hours.",
  },
  {
    title: "Market depth is off the Basic plan",
    body: "market-pairs/latest would let the thin-market check use real depth instead of a pair count, but it returns 403 on the Basic plan. Judges and most users will be on that plan.",
  },
];

export default function ApiNotesPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">API notes</h1>
      <p className="mt-4 text-pretty text-muted-foreground">
        What the CoinMarketCap API made possible, and where it got in the way. Every item below was reproduced against the
        live API while building Backed.
      </p>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">What it made possible</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        {enabled.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Where it got in the way</h2>
      <ol className="mt-4 space-y-5">
        {friction.map((f, i) => (
          <li key={f.title} className="grid gap-1 sm:grid-cols-[2rem_1fr]">
            <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>
            <div>
              <h3 className="text-sm font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">{f.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
