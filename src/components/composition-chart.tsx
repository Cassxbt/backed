"use client";

import Link from "next/link";
import { useState } from "react";
import { pct, usd } from "@/lib/format";
import { BUCKETS, type Buckets, StackBar, flaggedOf } from "./buckets";

export type CompositionRow = Buckets & { slug: string; name: string };

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
            aria-label={`${r.name}: ${pct(flaggedOf(r) / r.reported)} flagged, of ${usd(r.reported)} reported`}
            className="relative grid grid-cols-[6.5rem_1fr_6.5rem] items-center gap-3 rounded-sm py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[10rem_1fr_9rem]"
          >
            <span className="truncate text-xs">{r.name}</span>
            <span className="relative">
              <StackBar b={r} className="h-4" />
              {active === r.slug && (
                <span
                  role="tooltip"
                  className="absolute left-1/2 top-full z-10 mt-1 w-64 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
                >
                  <span className="block font-medium">
                    {r.name} · {usd(r.reported)} reported
                  </span>
                  <span className="mt-1 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-0.5 tabular-nums">
                    {BUCKETS.map((s) => (
                      <span key={s.key} className="contents">
                        <span className={`size-2 rounded-[2px] ${s.swatch}`} />
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="text-right">{usd(r[s.key])}</span>
                      </span>
                    ))}
                  </span>
                </span>
              )}
            </span>
            <span className="text-right font-mono text-xs tabular-nums">
              {pct(flaggedOf(r) / r.reported)} <span className="text-muted-foreground">of {usd(r.reported)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
