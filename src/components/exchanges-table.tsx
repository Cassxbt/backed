"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pct, ratio, usd } from "@/lib/format";

export type ExchangeRow = {
  slug: string;
  name: string;
  reported: number;
  flagged: number;
  flaggedShare: number;
  exemptShare: number;
  cover: number | null;
  wallets: number;
  audited: boolean;
};

type Key = Exclude<keyof ExchangeRow, "slug">;

const columns: { key: Key; label: string; format: (r: ExchangeRow) => string; numeric?: boolean }[] = [
  { key: "name", label: "Exchange", format: (r) => r.name },
  { key: "reported", label: "Reported", format: (r) => usd(r.reported), numeric: true },
  { key: "flagged", label: "Flagged", format: (r) => usd(r.flagged), numeric: true },
  { key: "flaggedShare", label: "Flagged share", format: (r) => pct(r.flaggedShare), numeric: true },
  { key: "exemptShare", label: "Exempt share", format: (r) => pct(r.exemptShare), numeric: true },
  { key: "cover", label: "OI ÷ reserves", format: (r) => ratio(r.cover), numeric: true },
  { key: "wallets", label: "Wallets", format: (r) => String(r.wallets), numeric: true },
  { key: "audited", label: "CMC audit flag", format: (r) => (r.audited ? "Yes" : "No"), numeric: true },
];

function compare(a: ExchangeRow, b: ExchangeRow, key: Key) {
  const x = a[key];
  const y = b[key];
  if (x == null) return 1;
  if (y == null) return -1;
  if (typeof x === "string" && typeof y === "string") return x.localeCompare(y);
  return Number(x) - Number(y);
}

export function ExchangesTable({ rows }: { rows: ExchangeRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: "reported", desc: true });

  const shown = rows
    .filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const c = compare(a, b, sort.key);
      return a[sort.key] == null || b[sort.key] == null ? c : sort.desc ? -c : c;
    });

  const toggle = (key: Key) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" }));

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find an exchange"
          aria-label="Find an exchange"
          className="pl-8"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => {
                const active = sort.key === c.key;
                const Icon = active ? (sort.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
                return (
                  <TableHead
                    key={c.key}
                    className={c.numeric ? "text-right" : undefined}
                    aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className="inline-flex items-center gap-1 text-xs font-medium hover:text-foreground"
                    >
                      {c.label}
                      <Icon className={`size-3 ${active ? "" : "opacity-40"}`} />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.slug}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.numeric ? "text-right font-mono text-sm tabular-nums" : "text-sm"}>
                    {c.key === "name" ? (
                      <Link href={`/exchange/${r.slug}`} className="font-medium underline-offset-4 hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      c.format(r)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  No exchange matches “{query}”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
