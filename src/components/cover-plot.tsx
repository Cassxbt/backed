"use client";

import Link from "next/link";
import { useState } from "react";
import { ratio, usd } from "@/lib/format";

export type CoverRow = {
  slug: string;
  name: string;
  cover: number;
  openInterest: number;
  reserves: number;
  reportsLiquidations: boolean;
};

const MIN = 0.01;
const MAX = 3000;
const TICKS = [0.01, 0.1, 1, 10, 100, 1000];
const LABELS = [0.01, 1, 10, 100, 1000];
const ROW = 18;

const x = (v: number) => (Math.log10(Math.min(Math.max(v, MIN), MAX)) - Math.log10(MIN)) / (Math.log10(MAX) - Math.log10(MIN));

export function CoverPlot({ rows }: { rows: CoverRow[] }) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div>
      <div className="grid grid-cols-[7.5rem_1fr_4.5rem] items-end gap-3 pb-2 text-[11px] text-muted-foreground sm:grid-cols-[10rem_1fr_5rem]">
        <span>Exchange</span>
        <div className="relative h-4">
          {LABELS.map((t) => (
            <span key={t} className={`absolute -translate-x-1/2 tabular-nums ${t === 1 || t === 100 ? "" : "hidden sm:inline"}`} style={{ left: `${x(t) * 100}%` }}>
              {t.toLocaleString("en-US")}×
            </span>
          ))}
        </div>
        <span className="text-right">OI ÷ reserves</span>
      </div>

      <ul className="relative" onMouseLeave={() => setActive(null)}>
        <div className="pointer-events-none absolute inset-y-0 left-[calc(7.5rem+0.75rem)] right-[calc(4.5rem+0.75rem)] sm:left-[calc(10rem+0.75rem)] sm:right-[calc(5rem+0.75rem)]">
          {TICKS.map((t) => (
            <span
              key={t}
              className={t === 1 ? "absolute inset-y-0 w-px bg-foreground/40" : "absolute inset-y-0 w-px bg-border"}
              style={{ left: `${x(t) * 100}%` }}
            />
          ))}
        </div>
        {rows.map((r) => {
          const over = r.cover > 1;
          const isActive = active === r.slug;
          return (
            <li key={r.slug} style={{ height: ROW }}>
              <Link
                href={`/exchange/${r.slug}`}
                onMouseEnter={() => setActive(r.slug)}
                onFocus={() => setActive(r.slug)}
                onBlur={() => setActive(null)}
                aria-label={`${r.name}: open interest ${usd(r.openInterest)}, reserves ${usd(r.reserves)}, ${ratio(r.cover)}`}
                className="group relative grid h-full grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[10rem_1fr_5rem]"
              >
                <span className={`truncate text-xs ${over ? "text-foreground" : "text-muted-foreground"}`}>{r.name}</span>
                <span className="relative h-full">
                  <span
                    className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background ${
                      over ? "bg-foreground" : "bg-muted-foreground/60"
                    } ${isActive ? "scale-125" : ""}`}
                    style={{ left: `${x(r.cover) * 100}%` }}
                  />
                  {isActive && (
                    <span
                      role="tooltip"
                      className="absolute top-full z-10 mt-1 w-56 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
                      style={{ left: `${Math.min(Math.max(x(r.cover) * 100, 20), 80)}%` }}
                    >
                      <span className="block font-medium">{r.name}</span>
                      <span className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums text-muted-foreground">
                        <span>Open interest</span>
                        <span className="text-right text-foreground">{usd(r.openInterest)}</span>
                        <span>Disclosed reserves</span>
                        <span className="text-right text-foreground">{usd(r.reserves)}</span>
                        <span>Liquidations to CMC</span>
                        <span className="text-right text-foreground">{r.reportsLiquidations ? "Reported" : "Not reported"}</span>
                      </span>
                    </span>
                  )}
                </span>
                <span className="text-right font-mono text-xs tabular-nums">{ratio(r.cover)}</span>
              </Link>
            </li>
          );
        })}
      </ul>

    </div>
  );
}
