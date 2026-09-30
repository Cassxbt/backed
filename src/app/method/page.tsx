import type { Metadata } from "next";
import { Eyebrow } from "@/components/section";
import { SourceLimits } from "@/components/source-limits";
import { METHOD_VERSION, THIN_MARKET_PAIRS } from "@/lib/checks";
import { snapshot } from "@/lib/data";
import { utc } from "@/lib/format";

export const metadata: Metadata = { title: "Method — Backed" };

const checks = [
  {
    title: "Unverified supply",
    rule: "circulating_supply is 0, or the token is not returned by quotes/latest",
    body: "CoinMarketCap withholds a circulating supply and market cap when it has not verified a token's supply. The reserve total still counts these tokens at full price. Backed flags the whole holding as an evidence gap. It does not say the token is worthless.",
  },
  {
    title: "Above circulating supply",
    rule: "balance held > circulating_supply",
    body: "The disclosed holding is larger than CoinMarketCap's circulating-supply figure. The two datasets can differ in scope or timing: locked or treasury supply, other chains, or delayed balances can all produce this. Backed flags only the part above circulating supply, as a discrepancy. Ownership cannot be inferred from it.",
  },
  {
    title: "Thin market",
    rule: `num_market_pairs <= ${THIN_MARKET_PAIRS}; a missing count is unknown, not thin`,
    body: "The reserve value is balance times price. When a token trades on two pairs or fewer, that price comes from a very small market. The pair count is a proxy, not a depth measurement: market depth is not available on the Basic plan.",
  },
  {
    title: "Exempt, not evaluated",
    rule: "tags stablecoin, wrapped-tokens, liquid-staking-derivatives, rehypothecated-crypto",
    body: "Stablecoins and wrapped or staked tokens get their value from redemption, which market data cannot test, and their CoinMarketCap supply is often counted on one chain only. They skip checks 2 and 3 and are shown as exempt, never as passing. They are still flagged by check 1.",
  },
];

export default function MethodPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <Eyebrow>Three flags, one exemption, one rulebook</Eyebrow>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-tight sm:text-6xl">Method</h1>
      <p className="mt-6 text-lg text-pretty text-muted-foreground">
        Backed uses only fields from the CoinMarketCap Pro API, with no tunable weights. Every holding lands in exactly one
        bucket: flagged, exempt, or not flagged. The flags never overlap: a holding is unverified, thin, or above
        circulating supply, in that order. Not flagged means these checks found nothing. It does not mean the value is
        verified.
      </p>

      <ol className="mt-10 space-y-8">
        {checks.map((c, i) => (
          <li key={c.title} className="grid gap-2 sm:grid-cols-[2rem_1fr]">
            <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>
            <div>
              <h2 className="font-medium">{c.title}</h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{c.rule}</p>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">{c.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-14 font-display text-3xl tracking-tight">Open interest</h2>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        <code>open_interest_usd</code> divided by reported reserves. Open interest is not a liability and wallet
        disclosures cover different things, so the ratio is shown beside the result, never subtracted. CoinMarketCap
        reports open interest of exactly zero for some exchanges with billions in derivatives volume; Backed treats zero as
        no data.
      </p>

      <div className="mt-14">
        <SourceLimits />
      </div>

      <h2 className="mt-14 font-display text-3xl tracking-tight">What this is not</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Not a solvency or backing test. The reserve data has no liabilities.</li>
        <li>Not an ownership ledger. A supply discrepancy does not say whose tokens they are.</li>
        <li>Not a rating. Backed does not rank exchanges as safe or unsafe.</li>
        <li>Not an audit. Wallets and balances are taken from CoinMarketCap as returned, not checked on-chain.</li>
      </ul>

      <h2 className="mt-14 font-display text-3xl tracking-tight">Pipeline and checks on it</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground [&_code]:break-all">
        <li>
          <code>/v1/exchange/map</code> lists {snapshot.exchangesListed} active exchanges. The run stops if the list hits
          the page limit.
        </li>
        <li>
          <code>/v1/exchange/info</code>, 100 exchanges per call, finds the {snapshot.porReporting} marked as publishing
          proof-of-reserves.
        </li>
        <li>
          <code>/v1/exchange/assets</code> returns wallets for {snapshot.exchanges.length} of them. Any failed request stops
          the run, so a partial set is never published. Negative or non-finite numbers stop it too.
        </li>
        <li>
          Exact duplicate rows are dropped. EVM addresses are matched without regard to case; other address formats are
          case-sensitive and kept as returned. When one wallet and token come back with two balances, the larger is kept
          and the conflict is counted.
        </li>
        <li>
          <code>/v2/cryptocurrency/quotes/latest</code>, 100 tokens per call, adds supply, market pairs, volume and tags
          for every held token.
        </li>
        <li>
          <code>/v5/exchange/derivatives/list</code> adds open interest, and{" "}
          <code>/v5/derivatives/liquidations/exchange/list/latest</code> shows which exchanges appear in CoinMarketCap&apos;s
          latest liquidation list. The list leaves out exchanges without an integrated feed and those with no recent
          liquidations, so absence is not evidence of either. Open interest reported as exactly 0 is kept in the inputs but
          gives no ratio.
        </li>
      </ol>
      <p className="mt-4 text-sm text-pretty text-muted-foreground">
        The current snapshot ran from {utc(snapshot.startedAt)} to {utc(snapshot.generatedAt)} with {snapshot.calls.length}{" "}
        calls and {snapshot.credits} credits on the free Basic plan, method {METHOD_VERSION}. Every CoinMarketCap response the
        checks read is kept in <code>data/inputs.json</code>, whose SHA-256 is recorded in the snapshot.{" "}
        <code>npm run replay</code> rebuilds <code>data/snapshot.json</code> from it offline and fails unless every field
        matches exactly.
      </p>
    </article>
  );
}
