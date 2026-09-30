import Link from "next/link";
import { pct, ratio, usd } from "@/lib/format";
import { BUCKETS, type Buckets, StackBar, flaggedOf } from "./buckets";

export type CardExchange = Buckets & {
  slug: string;
  name: string;
  cover: number | null;
  reportsLiquidations: boolean;
  wallets: number;
};

export type CardRefusal = { slug: string; name: string; audited: boolean };

export function ExchangeCard({ e, link = true }: { e: CardExchange; link?: boolean }) {
  const flagged = flaggedOf(e);
  const share = (v: number) => (e.reported > 0 ? v / e.reported : 0);
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[0_1px_0_0_var(--border)] sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-medium">{e.name}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{e.wallets} wallets</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Reported</p>
          <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight">{usd(e.reported)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Flagged by the checks</p>
          <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight">{usd(flagged)}</p>
        </div>
      </div>

      <div className="mt-4" aria-label={`${pct(share(flagged))} flagged, ${pct(share(e.exempt))} exempt, ${pct(share(e.passed))} not flagged`}>
        <StackBar b={e} />
      </div>
      <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">{pct(share(flagged))} flagged</p>

      <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
        {BUCKETS.map((b) => (
          <div key={b.key} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span className={`size-2 rounded-[2px] ${b.swatch}`} />
              {b.label}
            </dt>
            <dd className="font-mono tabular-nums">{usd(e[b.key])}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4">
          <dt className="pl-4 text-muted-foreground">Open interest ÷ reserves</dt>
          <dd className="font-mono tabular-nums">{ratio(e.cover)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="pl-4 text-muted-foreground">CMC liquidation data</dt>
          <dd>{e.reportsLiquidations ? "Yes" : "None"}</dd>
        </div>
      </dl>

      {link && (
        <Link
          href={`/exchange/${e.slug}`}
          className="mt-5 inline-flex text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
        >
          Open the evidence
        </Link>
      )}
    </div>
  );
}

export function RefusalCard({ e }: { e: CardRefusal }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-medium">{e.name}</p>
        <p className="font-mono text-[11px] text-muted-foreground">no_wallets_returned</p>
      </div>
      <p className="mt-5 font-display text-3xl leading-tight">No wallets to check.</p>
      <p className="mt-3 text-sm text-pretty text-muted-foreground">
        CoinMarketCap lists {e.name} as publishing proof-of-reserves{e.audited ? ", with an audit flag" : ""}, but{" "}
        <code className="font-mono text-xs">/v1/exchange/assets</code> returns no wallets for it. That says nothing about
        the size of its reserves, so Backed shows no figure rather than a guess.
      </p>
    </div>
  );
}
