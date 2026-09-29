import Link from "next/link";
import { pct, ratio, usd } from "@/lib/format";

export type CardExchange = {
  slug: string;
  name: string;
  reported: number;
  backed: number;
  unverified: number;
  thin: number;
  excess: number;
  cover: number | null;
  reportsLiquidations: boolean;
  wallets: number;
};

export type CardRefusal = { slug: string; name: string; audited: boolean };

const rows = [
  { key: "unverified", label: "Unverified supply", dot: "bg-unverified" },
  { key: "excess", label: "Above circulating supply", dot: "bg-excess" },
  { key: "thin", label: "Thin market", dot: "bg-thin" },
] as const;

export function ExchangeCard({ e }: { e: CardExchange }) {
  const share = e.reported > 0 ? e.backed / e.reported : 0;
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
          <p className="text-xs text-muted-foreground">Backed on these checks</p>
          <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight">{usd(e.backed)}</p>
        </div>
      </div>

      <div className="mt-4 flex h-2.5 gap-[2px]" aria-label={`${pct(share)} backed`}>
        <span className="rounded-l-[3px] bg-backed" style={{ width: `${share * 100}%`, minWidth: share > 0 ? 2 : 0 }} />
        {rows.map((r) =>
          e[r.key] > 0 ? (
            <span key={r.key} className={`last:rounded-r-[3px] ${r.dot}`} style={{ width: `${(e[r.key] / e.reported) * 100}%`, minWidth: 2 }} />
          ) : null,
        )}
      </div>
      <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">{pct(share)} backed</p>

      <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span className={`size-2 rounded-[2px] ${r.dot}`} />
              {r.label}
            </dt>
            <dd className="font-mono tabular-nums">{usd(e[r.key])}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4">
          <dt className="pl-4 text-muted-foreground">Open interest ÷ reserves</dt>
          <dd className="font-mono tabular-nums">{ratio(e.cover)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="pl-4 text-muted-foreground">Liquidations to CMC</dt>
          <dd>{e.reportsLiquidations ? "Reported" : "Not reported"}</dd>
        </div>
      </dl>

      <Link
        href={`/exchange/${e.slug}`}
        className="mt-5 inline-flex text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
      >
        Open the evidence
      </Link>
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
      <p className="mt-5 font-display text-3xl leading-tight">Backed will not score this exchange.</p>
      <p className="mt-3 text-sm text-pretty text-muted-foreground">
        CoinMarketCap marks {e.name} as publishing proof-of-reserves
        {e.audited ? " and flags it as audited" : ""}, but <code className="font-mono text-xs">/v1/exchange/assets</code>{" "}
        returns no wallets. With nothing to check, Backed shows no figure rather than a guess.
      </p>
    </div>
  );
}
