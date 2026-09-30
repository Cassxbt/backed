import Link from "next/link";
import { Legend } from "@/components/buckets";
import { CompositionChart } from "@/components/composition-chart";
import { CoverPlot } from "@/components/cover-plot";
import { ExchangeCard } from "@/components/exchange-card";
import { ExchangeCheck } from "@/components/exchange-check";
import { ExchangesTable } from "@/components/exchanges-table";
import { Eyebrow, Section } from "@/components/section";
import { SourceLimits } from "@/components/source-limits";
import { THIN_MARKET_PAIRS } from "@/lib/checks";
import { callCounts, flaggedUsd, getExchange, refusals, snapshot, summary, toCard, verification } from "@/lib/data";
import { num, pct, usd, utc } from "@/lib/format";

const PICKS = ["mexc", "weex", "binance", "coinbase-exchange", "lbank"];
const FLAG_SHARE_SHOWN = 0.005;

export default function Home() {
  const s = summary();
  const xs = snapshot.exchanges;
  const hero = getExchange("lbank") ?? xs[0];
  const share = (v: number, of: number) => (of > 0 ? v / of : 0);

  const coverRows = xs
    .filter((e) => e.cover != null)
    .sort((a, b) => b.cover! - a.cover!)
    .map((e) => ({
      slug: e.slug,
      name: e.name,
      cover: e.cover!,
      openInterest: e.openInterestUsd!,
      reserves: e.reportedUsd,
      inLiquidationResponse: e.inLiquidationResponse,
    }));

  const flaggedRows = xs
    .filter((e) => share(flaggedUsd(e), e.reportedUsd) >= FLAG_SHARE_SHOWN)
    .sort((a, b) => share(flaggedUsd(b), b.reportedUsd) - share(flaggedUsd(a), a.reportedUsd))
    .map(toCard);

  const tableRows = xs.map((e) => ({
    slug: e.slug,
    name: e.name,
    reported: e.reportedUsd,
    flagged: flaggedUsd(e),
    flaggedShare: share(flaggedUsd(e), e.reportedUsd),
    exemptShare: share(e.exemptUsd, e.reportedUsd),
    cover: e.cover,
    wallets: e.walletCount,
    audited: e.porAuditStatus === 1,
  }));

  const thinTotal = xs.reduce((n, e) => n + e.thinUsd, 0);
  const checks = [
    {
      n: "01",
      title: "Unverified supply",
      rule: "circulating_supply = 0",
      body: "CoinMarketCap withholds a circulating supply when it has not verified it, yet the reserve total prices those tokens in full. The holding is flagged as an evidence gap, not as worthless.",
    },
    {
      n: "02",
      title: "Above circulating supply",
      rule: "balance > circulating_supply",
      body: "The disclosed holding is larger than CoinMarketCap's circulating-supply figure. The two datasets can differ in scope or timing, so only the part above it is flagged, as a discrepancy. Who owns it cannot be inferred.",
    },
    {
      n: "03",
      title: "Thin market",
      rule: `num_market_pairs <= ${THIN_MARKET_PAIRS}`,
      body: `The token trades on ${THIN_MARKET_PAIRS} pairs or fewer, so its price comes from a very small market. A missing pair count is left unknown.${
        thinTotal === 0 ? " In this snapshot every such token is already caught by check 01, so it flags $0." : ""
      }`,
    },
    {
      n: "04",
      title: "Exempt, not evaluated",
      rule: "tags: stablecoin, wrapped, staked, rehypothecated",
      body: "Stablecoins and wrapped or staked tokens get their value from redemption, which market data cannot test. They are checked for unverified supply only, and otherwise shown as exempt rather than passed.",
    },
  ];

  const flag = hero.holdings.filter((h) => h.flag).sort((a, b) => b.flaggedUsd - a.flaggedUsd)[0] ?? hero.holdings[0];
  const flagToken = snapshot.tokens[String(flag.cryptoId)];
  const flagRow = flag.rows?.[0];
  const refused = refusals();
  const big = s.largestFlag;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid gap-12 pb-14 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
        <div>
          <Eyebrow>Build with CMC · Data and Visualisation</Eyebrow>
          <h1 className="mt-5 font-display text-5xl leading-[1.02] tracking-tight text-balance sm:text-6xl">
            Exchange reserves, checked against CoinMarketCap&apos;s own data.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
            CoinMarketCap already shows what each exchange&apos;s disclosed wallets hold. Backed checks every holding
            against CoinMarketCap&apos;s supply, market and derivatives data, and shows which part of the reported figure
            that data cannot confirm.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="#check"
              className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Check an exchange
            </Link>
            <Link
              href="#proof"
              className="inline-flex h-11 items-center rounded-full border px-5 text-sm font-medium transition-colors hover:border-foreground/40"
            >
              See the proof
            </Link>
          </div>
          <dl className="mt-8 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4">
            <HeroStat label="Exchanges" value={String(s.exchanges)} />
            <HeroStat label="Reported" value={usd(s.reported)} />
            <HeroStat label="Flagged" value={usd(s.flagged)} />
            <HeroStat label="Exempt" value={usd(s.exempt)} />
          </dl>
        </div>
        <div>
          <ExchangeCard e={toCard(hero)} />
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            Real result from the snapshot of {utc(snapshot.generatedAt)}
          </p>
        </div>
      </section>

      <Section
        eyebrow="The problem"
        title="A reserve figure is balances times prices. CoinMarketCap's reserve page does not check one against the other."
        lead={
          <p>
            The figure multiplies each disclosed wallet balance by a price. It includes tokens whose supply CoinMarketCap
            has not verified, holdings larger than the supply CoinMarketCap counts as circulating, and tokens that barely
            trade. CoinMarketCap&apos;s exchange pages show the allocation. They do not show which parts of it
            CoinMarketCap&apos;s own supply data leaves unverified or contradicts.
          </p>
        }
        aside={
          <div className="grid gap-px self-end overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
            <Fact
              value={`${usd(hero.unverifiedUsd)} of ${usd(hero.reportedUsd)}`}
              body={`of ${hero.name}'s reported reserves are in tokens whose circulating supply CoinMarketCap has not verified.`}
            />
            <Fact
              value={`${usd(s.flagged)} of ${usd(s.reported)}`}
              body={`of all reported reserves is flagged. The largest single flag is ${big.symbol} at ${big.exchange}, ${usd(big.usd)}.`}
            />
          </div>
        }
      />

      <Section
        id="findings"
        eyebrow="Finding 1"
        title="Where the reported figure rests on holdings CoinMarketCap's own data cannot confirm."
        lead={
          <p>
            {flaggedRows.length} exchanges have {pct(FLAG_SHARE_SHOWN)} or more of their reported reserves flagged, sorted by flagged share.
            The other {xs.length - flaggedRows.length} have less. Across all exchanges, {pct(share(s.exempt, s.reported), 0)}{" "}
            of reported value is exempt and shown as not evaluated.
          </p>
        }
      >
        <Legend rows={flaggedRows} />
        <div className="mt-4">
          <CompositionChart rows={flaggedRows} />
        </div>
      </Section>

      <Section
        eyebrow="Finding 2"
        title={`At ${s.overOne.count} exchanges, futures open interest is larger than the reserves they disclose.`}
        lead={
          <p>
            {s.overTen.count} carry more than ten times, {usd(s.overTen.openInterest)} on {usd(s.overTen.reserves)}. Open
            interest and wallet disclosures cover different things, so the ratio shows exposure, not a shortfall, and it is
            largest where disclosed reserves are small. {s.overOne.inLiquidationResponse} of these {s.overOne.count}{" "}
            {s.overOne.inLiquidationResponse === 1 ? "appears" : "appear"} in
            CoinMarketCap&apos;s latest liquidation list, which leaves out exchanges without an integrated feed and those with no
            recent liquidations. {s.openInterestReportedZero} reserve-reporting exchanges have open interest reported as exactly
            zero; Backed treats that as unavailable and shows no ratio. The heavier line marks 1×.
          </p>
        }
      >
        <CoverPlot rows={coverRows} />
      </Section>

      <Section
        id="how"
        eyebrow="How it works"
        title="Three flags and one exemption. Only CoinMarketCap fields. No weights."
        lead={
          <p>
            Every holding lands in exactly one bucket: flagged, exempt, or not flagged. Not flagged means these checks found
            nothing, not that the value is verified.{" "}
            <Link href="/method" className="text-foreground underline underline-offset-4">
              Full method
            </Link>
          </p>
        }
      >
        <ol className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {checks.map((c) => (
            <li key={c.n} className="flex flex-col bg-card p-6">
              <span className="font-mono text-xs text-muted-foreground">{c.n}</span>
              <h3 className="mt-6 text-lg font-medium tracking-tight">{c.title}</h3>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">{c.body}</p>
              <code className="mt-auto pt-6 font-mono text-[11px] text-muted-foreground">{c.rule}</code>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        eyebrow="Why CoinMarketCap"
        title="Without CoinMarketCap, there is no Backed."
        lead={
          <p>
            Backed has no data of its own. Wallet-level reserves, verified supply next to self-reported supply, and open
            interest per exchange come from one CoinMarketCap key. Remove the API and there is nothing to check: no wallet
            list, no supply to compare against, no exposure to weigh.
          </p>
        }
        aside={
          <div className="self-end overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Needed for</th>
                  <th className="px-4 py-3 font-medium">CoinMarketCap source</th>
                </tr>
              </thead>
              <tbody className="[&_td]:px-4 [&_td]:py-3 [&_tr]:border-b [&_tr:last-child]:border-0">
                {sources.map(([need, source]) => (
                  <tr key={need}>
                    <td>{need}</td>
                    <td className="font-mono text-xs">{source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      />

      <Section
        id="check"
        eyebrow="Try it"
        title="Check an exchange."
        lead={
          <p>
            Pick an exchange you use. {refused.length} exchanges are listed by CoinMarketCap as publishing reserves, but
            the API returns no wallets for them. For those, Backed shows no figure rather than a guess.
          </p>
        }
      >
        <ExchangeCheck scored={xs.map(toCard)} refused={refused} picks={PICKS} />
      </Section>

      <Section
        id="proof"
        eyebrow="Proof"
        title="Every figure on this page comes from these calls, and every total replays offline."
        lead={
          <p>
            One snapshot is {snapshot.calls.length} calls and {snapshot.credits} credits on the free Basic plan, taken{" "}
            {utc(snapshot.startedAt)} to {utc(snapshot.generatedAt)} with method {snapshot.methodVersion}. Every exchange
            page lists the exact calls behind it.
          </p>
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-4 py-3 font-mono text-[11px] text-muted-foreground">
              {hero.name}&apos;s largest flag: the fields Backed reads
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
              {`$ curl -H "X-CMC_PRO_API_KEY: $KEY" \\
  "https://pro-api.coinmarketcap.com/v1/exchange/assets?id=${hero.id}"

{ "wallet_address": "${flagRow?.address ?? ""}",
  "platform": { "symbol": "${flagRow?.chain ?? ""}" },
  "currency": { "symbol": "${flag.symbol}", "crypto_id": ${flag.cryptoId} },
  "balance": ${num(flagRow?.balance).replaceAll(",", "")} }

$ curl ".../v2/cryptocurrency/quotes/latest?id=${flag.cryptoId}"

{ "circulating_supply": ${flagToken?.circulatingSupply ?? "null"},
  "self_reported_circulating_supply": ${flagToken?.selfReportedCirculatingSupply ?? "null"},
  "num_market_pairs": ${flagToken?.marketPairs ?? "null"} }`}
            </pre>
          </div>
          <div className="grid min-w-0 grid-cols-1 content-start gap-px overflow-hidden rounded-xl border bg-border">
            {callCounts().map((c) => (
              <div key={c.path} className="flex min-w-0 items-center justify-between gap-4 bg-card px-4 py-3">
                <code className="min-w-0 truncate font-mono text-xs">{c.path}</code>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {c.calls} call{c.calls === 1 ? "" : "s"}
                </span>
              </div>
            ))}
            <div className="space-y-2 bg-card px-4 py-3 text-sm text-pretty text-muted-foreground">
              <p>
                <code className="font-mono text-xs">npm run replay</code> rebuilds the whole snapshot from its inputs
                (<code className="font-mono text-xs">data/inputs.json</code>, sha256 {snapshot.inputsSha256.slice(0, 12)}:
                wallet rows as returned, plus the CoinMarketCap fields the checks read), offline and without a key, and fails
                unless every field matches exactly. Each exchange page has a receipt that replays on its own.
              </p>
              <p>
                {verification ? (
                  <>
                    <code className="font-mono text-xs">npm run verify</code> re-fetched {verification.results.length}{" "}
                    exchanges at {utc(verification.at)} and recomputed them with separate code. Every reported, flagged and
                    exempt figure matched this snapshot within {pct(verification.maxDiff, 2)}, under a{" "}
                    {pct(verification.tolerance, 0)} tolerance for price movement. It fails if an exchange is missing or any
                    figure differs by more. Run it with your own key to check this yourself.
                  </>
                ) : (
                  <>Live verification has not been run against this snapshot.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow="Trust boundary" title="What Backed shows, what it does not, and what the source covers.">
        <div className="grid gap-4 md:grid-cols-3">
          <Boundary
            title="What it shows"
            items={[
              "Which parts of a reported reserve CoinMarketCap's own supply and market data cannot confirm.",
              "Futures exposure next to the reserves an exchange discloses.",
              "The CoinMarketCap rows and calls behind every figure.",
            ]}
          />
          <Boundary
            title="What it does not"
            items={[
              "Solvency or backing. The data has no liabilities, and not flagged is not verified.",
              "Ownership. A holding above circulating supply is a discrepancy, not proof of whose it is.",
              "A safety rating. Exchanges are not ranked as safe or unsafe.",
            ]}
          />
          <SourceLimits />
        </div>
      </Section>

      <Section
        id="exchanges"
        eyebrow="All exchanges"
        title="Every exchange with wallets in the API."
        lead={
          <p>
            Sort by any column. Open an exchange for its holdings, flags and the calls behind them. None of the{" "}
            {xs.length} carries CoinMarketCap&apos;s audit flag; all {refused.filter((r) => r.audited).length} exchanges that
            do return no wallets.
          </p>
        }
      >
        <ExchangesTable rows={tableRows} />
      </Section>
    </div>
  );
}

const sources: [string, string][] = [
  ["What each exchange holds", "/v1/exchange/assets"],
  ["01 Unverified supply", "quotes/latest · circulating_supply"],
  ["02 Above circulating supply", "quotes/latest · circulating_supply"],
  ["03 Thin market", "quotes/latest · num_market_pairs"],
  ["04 Exempt assets", "quotes/latest · tags"],
  ["Open interest", "/v5/exchange/derivatives/list"],
  ["Liquidation coverage", "/v5/derivatives/liquidations/…"],
];

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-lg tabular-nums">{value}</dd>
    </div>
  );
}

function Fact({ value, body }: { value: string; body: string }) {
  return (
    <div className="bg-card p-6">
      <p className="font-display text-3xl leading-tight">{value}</p>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">{body}</p>
    </div>
  );
}

function Boundary({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i} className="text-pretty">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
