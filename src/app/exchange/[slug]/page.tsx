import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompositionChart, Legend } from "@/components/composition-chart";
import { FlagBadge } from "@/components/flag-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { callsFor, getExchange, history, snapshot } from "@/lib/data";
import { days, num, pct, ratio, usd, utc } from "@/lib/format";
import { THIN_MARKET_PAIRS } from "@/lib/checks";

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
  const composition = [
    {
      slug: e.slug,
      name: e.name,
      reported: e.reportedUsd,
      backed: e.backedUsd,
      unverified: e.unverifiedUsd,
      thin: e.thinUsd,
      excess: e.excessUsd,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="py-10">
        <Link href="/#exchanges" className="text-sm text-muted-foreground hover:text-foreground">
          ← All exchanges
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{e.name}</h1>
        <p className="mt-2 text-muted-foreground">
          Reported reserves <span className="text-foreground tabular-nums">{usd(e.reportedUsd)}</span>. Backed on these
          checks <span className="text-foreground tabular-nums">{usd(e.backedUsd)}</span> ({pct(e.backedShare)}).
        </p>
        <div className="mt-6 space-y-3">
          <CompositionChart rows={composition} />
          <Legend rows={composition} />
        </div>
      </div>

      <section className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2">
        <Check
          title="Unverified supply"
          value={usd(e.unverifiedUsd)}
          share={e.reportedUsd ? e.unverifiedUsd / e.reportedUsd : 0}
          body="Tokens for which CoinMarketCap shows no verified circulating supply. The reserve marks them at full price anyway."
          field="circulating_supply = 0"
        />
        <Check
          title="Above circulating supply"
          value={usd(e.excessUsd)}
          share={e.reportedUsd ? e.excessUsd / e.reportedUsd : 0}
          body="The part of a holding that is larger than the token's whole circulating supply. It cannot all be customer deposits."
          field="balance > circulating_supply"
        />
        <Check
          title="Thin market"
          value={usd(e.thinUsd)}
          share={e.reportedUsd ? e.thinUsd / e.reportedUsd : 0}
          body={`Tokens that trade on ${THIN_MARKET_PAIRS} or fewer market pairs, so the price behind the reserve figure comes from a very small market.`}
          field={`num_market_pairs <= ${THIN_MARKET_PAIRS}`}
        />
        <div className="bg-background p-5">
          <h3 className="text-sm font-medium">Disclosure</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Open interest ÷ reserves</dt>
            <dd className="text-right font-mono tabular-nums">{ratio(e.cover)}</dd>
            <dt className="text-muted-foreground">Open interest</dt>
            <dd className="text-right font-mono tabular-nums">{usd(e.openInterestUsd)}</dd>
            <dt className="text-muted-foreground">Liquidations to CMC</dt>
            <dd className="text-right">{e.reportsLiquidations ? "Reported" : "Not reported"}</dd>
            <dt className="text-muted-foreground">Wallets / chains</dt>
            <dd className="text-right font-mono tabular-nums">
              {e.walletCount} / {e.chains.length}
            </dd>
            <dt className="text-muted-foreground">Audit flag</dt>
            <dd className="text-right">{e.porAuditStatus === 1 ? "Yes" : "No"}</dd>
          </dl>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            porAuditStatus, open_interest_usd, liquidations list
          </p>
        </div>
      </section>

      <section className="py-12">
        <h2 className="text-lg font-semibold tracking-tight">Holdings</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Largest holdings and every flagged holding over $10K. Stablecoins, wrapped tokens and liquid-staking tokens are
          only checked for unverified supply.
          {e.otherHoldings.count > 0 &&
            ` ${e.otherHoldings.count} smaller holdings worth ${usd(e.otherHoldings.usd)} are included in the totals.`}
        </p>
        <div className="mt-6 overflow-x-auto rounded-lg border">
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
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {pct(e.reportedUsd ? h.usd / e.reportedUsd : 0)}
                  </TableCell>
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
      </section>

      {flagged.length > 0 && (
        <section className="border-t py-12">
          <h2 className="text-lg font-semibold tracking-tight">Evidence for each flag</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The CoinMarketCap fields behind every flag, and the largest wallets holding the token.
          </p>
          <div className="mt-6 space-y-3">
            {flagged.map((h) => {
              const t = snapshot.tokens[String(h.cryptoId)];
              return (
                <details key={h.cryptoId} className="group rounded-lg border px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm">
                    <span>
                      <span className="font-medium">{h.symbol}</span>{" "}
                      <span className="text-muted-foreground">{usd(h.flaggedUsd)} flagged</span>
                    </span>
                    <FlagBadge flag={h.flag} />
                  </summary>
                  <div className="mt-4 grid gap-6 md:grid-cols-2">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                      <dt className="text-muted-foreground">id</dt>
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
                      <dt className="text-muted-foreground">market_cap</dt>
                      <dd>{usd(t?.marketCap)}</dd>
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
        </section>
      )}

      <section className="border-t py-12">
        <h2 className="text-lg font-semibold tracking-tight">CoinMarketCap calls behind this page</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every figure above comes from these requests, made {utc(snapshot.generatedAt)}. Reproduce the reserve call with
          your own key:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs">
          {`curl -H "X-CMC_PRO_API_KEY: $CMC_PRO_API_KEY" \\\n  "https://pro-api.coinmarketcap.com/v1/exchange/assets?id=${e.id}"`}
        </pre>
        <ul className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
          {calls.map((c, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-x-4">
              <span className="break-all">
                GET {c.path}
                {c.path === "/v1/exchange/assets" ? `?id=${c.params.id}` : ""}
              </span>
              <span className="shrink-0">
                {c.credits} credit{c.credits === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
        {points.length > 1 && (
          <p className="mt-6 text-sm text-muted-foreground">
            {points.length} snapshots recorded since {utc(points[0].at)}.
          </p>
        )}
      </section>
    </div>
  );
}

function Check({ title, value, share, body, field }: { title: string; value: string; share: number; body: string; field: string }) {
  return (
    <div className="bg-background p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{pct(share)} of reserves</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">{body}</p>
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">{field}</p>
    </div>
  );
}
