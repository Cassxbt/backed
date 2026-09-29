import type { Metadata } from "next";
import { Eyebrow } from "@/components/section";
import { THIN_MARKET_PAIRS } from "@/lib/checks";
import { snapshot } from "@/lib/data";
import { utc } from "@/lib/format";

export const metadata: Metadata = { title: "Method — Backed" };

const checks = [
  {
    title: "Unverified supply",
    rule: "circulating_supply is 0, or the token is not returned by quotes/latest",
    body: "CoinMarketCap withholds a circulating supply and market cap when it has not verified a token's supply. The reserve total still counts these tokens at full price. Backed flags the whole holding.",
  },
  {
    title: "Above circulating supply",
    rule: "balance held > circulating_supply",
    body: "Customers can only deposit tokens that circulate. When an exchange's wallets hold more than the whole circulating supply, the extra is most likely the exchange's own treasury, not customer deposits. Backed flags only that extra.",
  },
  {
    title: "Thin market",
    rule: `num_market_pairs <= ${THIN_MARKET_PAIRS}`,
    body: "The reserve value is balance times price. When a token trades on two pairs or fewer, that price comes from a very small market. In the current snapshot this check flags nothing: every such token is already caught as unverified supply, or is a redeemable asset.",
  },
  {
    title: "Open interest against reserves",
    rule: "open_interest_usd ÷ reported reserves, porAuditStatus, liquidation reporting, wallet count",
    body: "Open interest is the value of open futures positions. It is not a liability, so it is shown beside the reserves, not subtracted from them. The same card shows whether CoinMarketCap marks the reserves as audited and whether the exchange reports liquidations.",
  },
];

export default function MethodPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <Eyebrow>Four checks, one rulebook</Eyebrow>
      <h1 className="mt-4 font-display text-5xl leading-none tracking-tight sm:text-6xl">Method</h1>
      <p className="mt-6 text-lg text-pretty text-muted-foreground">
        Backed uses only fields from the CoinMarketCap Pro API. There are no tunable weights: every exchange is measured
        by the same rules, and every flagged dollar links back to the fields that caused it. The checked value is
        reported reserves minus the three flags. The flags never overlap: a holding is unverified, thin, or above circulating
        supply, in that order.
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

      <h2 className="mt-14 font-display text-3xl tracking-tight">Redeemable assets</h2>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        Stablecoins, wrapped tokens and liquid-staking tokens (CoinMarketCap tags <code>stablecoin</code>,{" "}
        <code>wrapped-tokens</code>, <code>liquid-staking-derivatives</code>, <code>rehypothecated-crypto</code>) get their value from redemption, not from
        trading, and their circulating supply on CoinMarketCap is often counted on one chain only. They are exempt from
        the thin-market and circulating-supply checks, and are still flagged when CoinMarketCap has not verified their
        supply.
      </p>

      <h2 className="mt-14 font-display text-3xl tracking-tight">What this is not</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Not a solvency test. The reserve data has no liabilities, so nothing here says an exchange can or cannot pay.</li>
        <li>Not a rating. Backed does not rank exchanges as safe or unsafe.</li>
        <li>Not an audit. Wallet lists come from the exchanges through CoinMarketCap and are not checked on-chain here.</li>
      </ul>

      <h2 className="mt-14 font-display text-3xl tracking-tight">Pipeline</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground [&_code]:break-all">
        <li>
          <code>/v1/exchange/map</code> lists {snapshot.exchangesListed} active exchanges.
        </li>
        <li>
          <code>/v1/exchange/info</code>, 100 exchanges per call, finds the {snapshot.porReporting} marked as publishing
          proof-of-reserves.
        </li>
        <li>
          <code>/v1/exchange/assets</code> returns wallets for {snapshot.exchanges.length} of them. Duplicate rows are
          dropped, matching addresses without regard to letter case.
        </li>
        <li>
          <code>/v2/cryptocurrency/quotes/latest</code>, 100 tokens per call, adds supply, market pairs, volume and tags
          for every held token.
        </li>
        <li>
          <code>/v5/exchange/derivatives/list</code> adds open interest per exchange.
        </li>
        <li>
          <code>/v5/derivatives/liquidations/exchange/list/latest</code> shows which exchanges report liquidations.
        </li>
      </ol>
      <p className="mt-4 text-sm text-muted-foreground">
        The current snapshot was taken {utc(snapshot.generatedAt)} with {snapshot.calls.length} calls and{" "}
        {snapshot.credits} credits, on the free Basic plan.
      </p>
    </article>
  );
}
