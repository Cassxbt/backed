import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExchangeCard } from "@/components/exchange-card";
import { FlagBadge } from "@/components/flag-badge";
import { Eyebrow, Section } from "@/components/section";
import { SourceLimits } from "@/components/source-limits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { THIN_MARKET_PAIRS } from "@/lib/checks";
import { callsFor, flaggedUsd, getExchange, snapshot, toCard } from "@/lib/data";
import { days, num, pct, ratio, usd, utc } from "@/lib/format";

const SHOWN = 40;
const SHOWN_FLAG_MIN_USD = 10_000;

export const dynamicParams = false;

export function generateStaticParams() {
  return snapshot.exchanges.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/exchange/[slug]">): Promise<Metadata> {
  const e = getExchange((await params).slug);
  return { title: e ? `${e.name} reserves — Backed` : "Backed" };
}

export default async function ExchangePage({ params }: PageProps<"/exchange/[slug]">) {
  const e = getExchange((await params).slug);
  if (!e) notFound();

  const flagged = e.holdings.filter((h) => h.flag);
  const shown = e.holdings.filter((h, i) => i < SHOWN || (h.flag && h.flaggedUsd >= SHOWN_FLAG_MIN_USD));
  const calls = callsFor(e);
  const tokenName = (id: number) => snapshot.tokens[String(id)]?.name ?? "";
  const share = (v: number) => (e.reportedUsd ? v / e.reportedUsd : 0);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid gap-10 pb-14 pt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
        <div>
          <Link href="/#exchanges" className="text-sm text-muted-foreground hover:text-foreground">
            ← All exchanges
          </Link>
          <div className="mt-8">
            <Eyebrow>Exchange · CoinMarketCap id {e.id}</Eyebrow>
          </div>
          <h1 className="mt-4 font-display text-6xl leading-none tracking-tight sm:text-7xl">{e.name}</h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
            Reports <span className="text-foreground">{usd(e.reportedUsd)}</span> across {e.walletCount} wallets on{" "}
            {e.chains.length} chains. <span className="text-foreground">{usd(flaggedUsd(e))}</span> (
            {pct(share(flaggedUsd(e)))}) is flagged, {pct(share(e.exemptUsd))} is exempt, and the rest is not flagged by
            these checks.
          </p>
        </div>
        <ExchangeCard e={toCard(e)} link={false} />
      </section>

      <Section eyebrow="The checks" title="What the reported figure is made of.">
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-2">
          <Check
            n="01"
            title="Unverified supply"
            value={usd(e.unverifiedUsd)}
            share={share(e.unverifiedUsd)}
            body="Tokens for which CoinMarketCap shows no verified circulating supply. The reserve prices them in full anyway. This marks an evidence gap, not a worthless token."
            field="circulating_supply = 0"
          />
          <Check
            n="02"
            title="Above circulating supply"
            value={usd(e.excessUsd)}
            share={share(e.excessUsd)}
            body="The part of a holding larger than CoinMarketCap's circulating-supply figure. The datasets can differ in scope or timing, and ownership cannot be inferred from this alone."
            field="balance > circulating_supply"
          />
          <Check
            n="03"
            title="Thin market"
            value={usd(e.thinUsd)}
            share={share(e.thinUsd)}
            body={`Tokens that trade on ${THIN_MARKET_PAIRS} or fewer market pairs, so their price comes from a very small market. A missing pair count is left unknown.`}
            field={`num_market_pairs <= ${THIN_MARKET_PAIRS}`}
          />
          <Check
            n="04"
            title="Exempt, not evaluated"
            value={usd(e.exemptUsd)}
            share={share(e.exemptUsd)}
            body="Stablecoins and wrapped or staked tokens. Their value depends on redemption, which market data cannot test, so they are not counted as passing."
            field="tags: stablecoin, wrapped, staked, rehypothecated"
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm font-medium">Open interest and disclosure</p>
            <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Open interest ÷ reserves</dt>
              <dd className="text-right font-mono tabular-nums">{ratio(e.cover)}</dd>
              <dt className="text-muted-foreground">Open interest</dt>
              {e.openInterestReportedZero ? (
                <dd className="text-right">Reported as $0, treated as unavailable</dd>
              ) : (
                <dd className="text-right font-mono tabular-nums">{usd(e.openInterestUsd)}</dd>
              )}
              <dt className="text-muted-foreground">In CMC liquidation list</dt>
              <dd className="text-right">{e.inLiquidationResponse ? "Yes" : "No"}</dd>
              <dt className="text-muted-foreground">Audit flag</dt>
              <dd className="text-right">{e.porAuditStatus === 1 ? "Yes" : "No"}</dd>
              <dt className="text-muted-foreground">Duplicate rows dropped</dt>
              <dd className="text-right font-mono tabular-nums">{e.duplicateRowsRemoved}</dd>
              <dt className="text-muted-foreground">Conflicting balances</dt>
              <dd className="text-right font-mono tabular-nums">{e.conflictingRows}</dd>
              {e.unpricedRows > 0 && (
                <>
                  <dt className="text-muted-foreground">Rows without a price</dt>
                  <dd className="text-right font-mono tabular-nums">{e.unpricedRows}</dd>
                </>
              )}
            </dl>
            <p className="mt-4 text-xs text-pretty text-muted-foreground">
              Open interest and wallet disclosures cover different things, so the ratio shows exposure, not a shortfall.
            </p>
          </div>
          <SourceLimits />
        </div>
      </Section>

      <Section
        eyebrow="Holdings"
        title="Every large holding, and every flag."
        lead={
          <p>
            {shown.length === e.holdings.length
              ? `All ${e.holdings.length} holdings.`
              : `${shown.length} of ${e.holdings.length} holdings: the ${SHOWN} largest and every smaller flagged holding over $10K.`}{" "}
            The raw rows behind all {e.holdings.length} are in this exchange&apos;s receipt below.
          </p>
        }
      >
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Of reserves</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Of circulating</TableHead>
                <TableHead className="text-right">Days of volume</TableHead>
                <TableHead className="text-right">Wallets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((h) => (
                <TableRow key={h.cryptoId}>
                  <TableCell className="text-sm">
                    <span className="font-medium">{h.symbol}</span>{" "}
                    <span className="text-muted-foreground">{tokenName(h.cryptoId)}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{usd(h.usd)}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{pct(share(h.usd))}</TableCell>
                  <TableCell className="text-sm">
                    <FlagBadge flag={h.flag} exempt={h.exempt} notEvaluated={h.notEvaluated} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{pct(h.shareOfCirculating)}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{days(h.daysOfVolume)}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{h.wallets}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      {flagged.length > 0 && (
        <Section
          eyebrow="Evidence"
          title="The fields behind each flag."
          lead={<p>What CoinMarketCap returned for each flagged token, and the largest wallets holding it.</p>}
        >
          <div className="space-y-3">
            {flagged.map((h) => {
              const t = snapshot.tokens[String(h.cryptoId)];
              return (
                <details key={h.cryptoId} className="group rounded-xl border bg-card px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm">
                    <span>
                      <span className="font-medium">{h.symbol}</span>{" "}
                      <span className="text-muted-foreground">{usd(h.flaggedUsd)} flagged</span>
                    </span>
                    <FlagBadge flag={h.flag} />
                  </summary>
                  <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                    <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono text-xs">
                      <dt className="text-muted-foreground">crypto_id</dt>
                      <dd>{h.cryptoId}</dd>
                      <dt className="text-muted-foreground">balance held</dt>
                      <dd>{num(h.balance)}</dd>
                      <dt className="text-muted-foreground">circulating_supply</dt>
                      <dd>{num(t?.circulatingSupply)}</dd>
                      <dt className="text-muted-foreground">self_reported_circulating</dt>
                      <dd>{num(t?.selfReportedCirculatingSupply)}</dd>
                      <dt className="text-muted-foreground">total_supply</dt>
                      <dd>{num(t?.totalSupply)}</dd>
                      <dt className="text-muted-foreground">num_market_pairs</dt>
                      <dd>{num(t?.marketPairs)}</dd>
                      <dt className="text-muted-foreground">volume_24h</dt>
                      <dd>{usd(t?.volume24h)}</dd>
                    </dl>
                    <ul className="min-w-0 space-y-1 font-mono text-xs">
                      {h.rows?.map((r) => (
                        <li key={`${r.address}-${r.chain}`} className="flex justify-between gap-4">
                          <span className="truncate text-muted-foreground" title={r.address}>
                            {r.chain} · {r.address}
                          </span>
                          <span className="shrink-0">{num(r.balance)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              );
            })}
          </div>
        </Section>
      )}

      <Section
        eyebrow="Proof"
        title="The calls behind this page."
        lead={
          <p>
            Every figure above comes from these requests, made between {utc(snapshot.startedAt)} and{" "}
            {utc(snapshot.generatedAt)}.
          </p>
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            <pre className="overflow-x-auto rounded-xl border bg-card p-5 font-mono text-xs leading-relaxed">
              {`$ curl -H "X-CMC_PRO_API_KEY: $KEY" \\
  "https://pro-api.coinmarketcap.com/v1/exchange/assets?id=${e.id}"`}
            </pre>
            <div className="rounded-xl border bg-card p-5 text-sm">
              <p className="font-medium">Receipt</p>
              <p className="mt-2 text-pretty text-muted-foreground">
                The raw CoinMarketCap rows and token data this page was computed from, with the published result. Replay
                rebuilds the result from the rows offline and fails on any difference.
              </p>
              <pre className="mt-3 overflow-x-auto font-mono text-xs">{`$ npm run replay -- backed-${e.slug}-receipt.json`}</pre>
              <p className="mt-3 font-mono text-xs text-muted-foreground">inputs sha256 {snapshot.inputsSha256.slice(0, 16)}…</p>
              <a
                href={`/exchange/${e.slug}/receipt.json`}
                download
                className="mt-4 inline-flex font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                Download receipt
              </a>
            </div>
          </div>
          <ul className="grid min-w-0 grid-cols-1 content-start gap-px self-start overflow-hidden rounded-xl border bg-border font-mono text-xs">
            {calls.map((c, i) => (
              <li key={i} className="flex min-w-0 justify-between gap-4 bg-card px-4 py-2.5">
                <span className="min-w-0 truncate">
                  GET {c.path}
                  {c.path === "/v1/exchange/assets" ? `?id=${c.params.id}` : ""}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {c.credits} credit{c.credits === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}

function Check({
  n,
  title,
  value,
  share,
  body,
  field,
}: {
  n: string;
  title: string;
  value: string;
  share: number;
  body: string;
  field: string;
}) {
  return (
    <div className="flex flex-col bg-card p-6">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-xs text-muted-foreground">{n}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{pct(share)} of reserves</span>
      </div>
      <h3 className="mt-4 text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-1 font-display text-4xl tabular-nums">{value}</p>
      <p className="mt-3 text-sm text-pretty text-muted-foreground">{body}</p>
      <code className="mt-auto pt-6 font-mono text-[11px] text-muted-foreground">{field}</code>
    </div>
  );
}
