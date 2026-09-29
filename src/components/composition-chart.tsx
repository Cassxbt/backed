"use client";

import Link from "next/link";
import { useState } from "react";
import { pct, usd } from "@/lib/format";

export type CompositionRow = {
  slug: string;
  name: string;
  reported: number;
  backed: number;
  unverified: number;
  thin: number;
  excess: number;
};

export const SEGMENTS = [
  { key: "backed", label: "Backed", className: "bg-backed" },
  { key: "unverified", label: "Unverified supply", className: "bg-unverified" },
  { key: "thin", label: "Thin market", className: "bg-thin" },
  { key: "excess", label: "Above circulating supply", className: "bg-excess" },
] as const;

export function Legend({ rows }: { rows: CompositionRow[] }) {
  const present = SEGMENTS.filter((s) => rows.some((r) => r[s.key] > 0));
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {present.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-[2px] ${s.className}`} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function CompositionChart({ rows }: { rows: CompositionRow[] }) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <ul className="space-y-1" onMouseLeave={() => setActive(null)}>
      {rows.map((r) => (
        <li key={r.slug}>
          <Link
            href={`/exchange/${r.slug}`}
            onMouseEnter={() => setActive(r.slug)}
            onFocus={() => setActive(r.slug)}
            onBlur={() => setActive(null)}
            aria-label={`${r.name}: ${pct(r.backed / r.reported)} backed of ${usd(r.reported)} reported`}
            className="relative grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 rounded-sm py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[10rem_1fr_5rem]"
          >
            <span className="truncate text-xs">{r.name}</span>
            <span className="relative flex h-4 gap-[2px]">
              {SEGMENTS.map((s) => {
                const v = r[s.key];
                if (v <= 0) return null;
                return (
                  <span
                    key={s.key}
                    className={`h-full first:rounded-l-[4px] last:rounded-r-[4px] ${s.className}`}
                    style={{ width: `${(v / r.reported) * 100}%`, minWidth: 2 }}
                  />
                );
              })}
              {active === r.slug && (
                <span
                  role="tooltip"
                  className="absolute left-1/2 top-full z-10 mt-1 w-60 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
                >
                  <span className="block font-medium">
                    {r.name} · {usd(r.reported)} reported
                  </span>
                  <span className="mt-1 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-0.5 tabular-nums">
                    {SEGMENTS.map((s) => (
                      <span key={s.key} className="contents">
                        <span className={`size-2 rounded-[2px] ${s.className}`} />
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="text-right">{usd(r[s.key])}</span>
                      </span>
                    ))}
                  </span>
                </span>
              )}
            </span>
            <span className="text-right font-mono text-xs tabular-nums">{pct(r.backed / r.reported)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
