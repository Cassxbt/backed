import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExchangeCard } from "@/components/exchange-card";
import { FlagBadge } from "@/components/flag-badge";
import { Eyebrow, Section } from "@/components/section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { THIN_MARKET_PAIRS } from "@/lib/checks";
import { callsFor, getExchange, history, snapshot, toCard } from "@/lib/data";
import { days, num, pct, ratio, usd, utc } from "@/lib/format";

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
  const calls = callsFor(e);
  const points = history.filter((p) => p.exchanges[e.slug]);
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
            {e.chains.length} chains. <span className="text-foreground">{pct(e.backedShare)}</span> of it is backed on
            these checks.
          </p>
        </div>
        <ExchangeCard e={toCard(e)} link={false} />
      </section>

      <Section eyebrow="The checks" title="What the reported number is made of.">
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-2">
          <Check
            n="01"
            title="Unverified supply"
            value={usd(e.unverifiedUsd)}
            share={share(e.unverifiedUsd)}
            body="Tokens for which CoinMarketCap shows no verified circulating supply. The reserve prices them in full anyway."
            field="circulating_supply = 0"
          />
          <Check
            n="02"
            title="Above circulating supply"
            value={usd(e.excessUsd)}
            share={share(e.excessUsd)}
            body="The part of a holding larger than the token's whole circulating supply. It cannot all belong to customers."
            field="balance > circulating_supply"
          />
          <Check
            n="03"
            title="Thin market"
            value={usd(e.thinUsd)}
            share={share(e.thinUsd)}
            body={`Tokens that trade on ${THIN_MARKET_PAIRS} or fewer market pairs, so their price comes from a very small market.`}
            field={`num_market_pairs <= ${THIN_MARKET_PAIRS}`}
          />
          <div className="bg-card p-6">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-xs text-muted-foreground">04</span>
            </div>
            <h3 className="mt-4 text-lg font-medium tracking-tight">Open interest and disclosure</h3>
            <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Open interest ÷ reserves</dt>
              <dd className="text-right font-mono tabular-nums">{ratio(e.cover)}</dd>
              <dt className="text-muted-foreground">Open interest</dt>
              <dd className="text-right font-mono tabular-nums">{usd(e.openInterestUsd)}</dd>
              <dt className="text-muted-foreground">Liquidations to CoinMarketCap</dt>
              <dd className="text-right">{e.reportsLiquidations ? "Reported" : "Not reported"}</dd>
              <dt className="text-muted-foreground">Audit flag</dt>
              <dd className="text-right">{e.porAuditStatus === 1 ? "Yes" : "No"}</dd>
            </dl>
            <code className="mt-6 block font-mono text-[11px] text-muted-foreground">open_interest_usd · porAuditStatus</code>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Holdings"
        title="Every large holding, and every flag."
        lead={
          <p>
            The {e.holdings.length} largest holdings and every flagged holding over $10K. Stablecoins, wrapped and staked
            tokens are only checked for unverified supply.
            {e.otherHoldings.count > 0 &&
              ` ${e.otherHoldings.count} smaller holdings worth ${usd(e.otherHoldings.usd)} are included in the totals.`}
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
                <TableHead>Check</TableHead>
                <TableHead className="text-right">Of circulating</TableHead>
                <TableHead className="text-right">Days of volume</TableHead>
                <TableHead className="text-right">Wallets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {e.holdings.map((h) => (
                <TableRow key={h.cryptoId}>
                  <TableCell className="text-sm">
                    <span className="font-medium">{h.symbol}</span>{" "}
                    <span className="text-muted-foreground">{tokenName(h.cryptoId)}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{usd(h.usd)}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{pct(share(h.usd))}</TableCell>
                  <TableCell className="text-sm">
                    <FlagBadge flag={h.flag} />
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
                  <div className="mt-5 grid gap-6 md:grid-cols-2">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono text-xs">
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
                    <ul className="space-y-1 font-mono text-xs">
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
            Every figure above comes from these requests, made {utc(snapshot.generatedAt)}.
            {points.length > 1 && ` ${points.length} snapshots recorded since ${utc(points[0].at)}.`}
          </p>
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <pre className="overflow-x-auto rounded-xl border bg-card p-5 font-mono text-xs leading-relaxed">
            {`$ curl -H "X-CMC_PRO_API_KEY: $KEY" \\
  "https://pro-api.coinmarketcap.com/v1/exchange/assets?id=${e.id}"`}
          </pre>
          <ul className="grid content-start gap-px overflow-hidden rounded-xl border bg-border font-mono text-xs">
            {calls.map((c, i) => (
              <li key={i} className="flex justify-between gap-4 bg-card px-4 py-2.5">
                <span className="truncate">
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
