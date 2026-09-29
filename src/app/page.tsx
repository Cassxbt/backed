import Link from "next/link";
import { CompositionChart, Legend } from "@/components/composition-chart";
import { CoverPlot } from "@/components/cover-plot";
import { ExchangesTable } from "@/components/exchanges-table";
import { flaggedUsd, snapshot, summary } from "@/lib/data";
import { usd } from "@/lib/format";

export default function Home() {
  const s = summary();
  const xs = snapshot.exchanges;

  const coverRows = xs
    .filter((e) => e.cover != null)
    .sort((a, b) => b.cover! - a.cover!)
    .map((e) => ({
      slug: e.slug,
      name: e.name,
      cover: e.cover!,
      openInterest: e.openInterestUsd!,
      reserves: e.reportedUsd,
      reportsLiquidations: e.reportsLiquidations,
    }));

  const flaggedRows = xs
    .filter((e) => e.reportedUsd > 0 && flaggedUsd(e) / e.reportedUsd >= 0.01)
    .sort((a, b) => a.backedShare - b.backedShare)
    .map((e) => ({
      slug: e.slug,
      name: e.name,
      reported: e.reportedUsd,
      backed: e.backedUsd,
      unverified: e.unverifiedUsd,
      thin: e.thinUsd,
      excess: e.excessUsd,
    }));

  const tableRows = xs.map((e) => ({
    slug: e.slug,
    name: e.name,
    reported: e.reportedUsd,
    backedShare: e.backedShare,
    flagged: flaggedUsd(e),
    cover: e.cover,
    wallets: e.walletCount,
    audited: e.porAuditStatus === 1,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="py-12 sm:py-16">
        <p className="text-sm text-muted-foreground">Proof-of-reserves, checked with CoinMarketCap data</p>
        <h1 className="mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          CoinMarketCap shows how much an exchange holds. Backed shows what it is made of.
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
          {s.exchanges} exchanges publish wallet-level reserves through the CoinMarketCap API. Backed runs four checks on
          each one, using only CoinMarketCap&apos;s own fields, and marks the part of each reported total that is not
          backed by verified, traded, circulating supply.{" "}
          <Link href="/method" className="text-foreground underline underline-offset-4">
            How the checks work
          </Link>
        </p>

        <dl className="mt-10 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
          <Stat label="Reported reserves" value={usd(s.reported)} note={`across ${s.exchanges} exchanges`} />
          <Stat
            label="Flagged by the checks"
            value={usd(s.flagged)}
            note={`${s.flaggedExchanges} exchanges have 5% or more flagged`}
          />
          <Stat
            label="Open interest above reserves"
            value={`${s.overOne.count} of ${s.withCover}`}
            note={`${usd(s.overOne.openInterest)} of open interest on ${usd(s.overOne.reserves)} of reserves`}
          />
        </dl>
      </section>

      <section className="border-t py-12">
        <SectionHead
          title="Open interest against disclosed reserves"
          body={`Open interest is the value of open futures positions on an exchange. It is not a debt, but it is trading exposure that sits on top of the reserves. ${s.overTen.count} exchanges carry more than ten times their disclosed reserves, ${usd(s.overTen.openInterest)} on ${usd(s.overTen.reserves)}. ${s.overOne.withoutLiquidations} of the ${s.overOne.count} exchanges above 1× do not report liquidations to CoinMarketCap.`}
        />
        <div className="mt-8">
          <CoverPlot rows={coverRows} />
        </div>
      </section>

      <section className="border-t py-12">
        <SectionHead
          title="Where reported reserves are not backed"
          body={`Exchanges with at least 1% of reported reserves flagged. The other ${xs.length - flaggedRows.length} exchanges are 99% or more backed on these checks.`}
        />
        <div className="mt-6">
          <Legend />
        </div>
        <div className="mt-4">
          <CompositionChart rows={flaggedRows} />
        </div>
      </section>

      <section id="exchanges" className="scroll-mt-4 border-t py-12">
        <SectionHead title="All exchanges" body="Every exchange with proof-of-reserves data in the CoinMarketCap API." />
        <div className="mt-6">
          <ExchangesTable rows={tableRows} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-background p-5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
      <dd className="mt-1 text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}

function SectionHead({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">{body}</p>
    </div>
  );
}
