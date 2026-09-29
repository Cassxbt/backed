"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { type CardExchange, type CardRefusal, ExchangeCard, RefusalCard } from "./exchange-card";

type Option = { kind: "scored"; e: CardExchange } | { kind: "refused"; e: CardRefusal };

export function ExchangeCheck({
  scored,
  refused,
  picks,
}: {
  scored: CardExchange[];
  refused: CardRefusal[];
  picks: string[];
}) {
  const options: Option[] = [
    ...scored.map((e) => ({ kind: "scored" as const, e })),
    ...refused.map((e) => ({ kind: "refused" as const, e })),
  ];
  const bySlug = new Map(options.map((o) => [o.e.slug, o]));
  const [selected, setSelected] = useState<Option>(bySlug.get(picks[0])!);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matches = q ? options.filter((o) => o.e.name.toLowerCase().includes(q)).slice(0, 6) : [];

  const choose = (o: Option) => {
    setSelected(o);
    setQuery("");
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <div>
        <label htmlFor="exchange-search" className="text-sm font-medium">
          Find an exchange
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="exchange-search"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            onKeyDown={(ev) => ev.key === "Enter" && matches[0] && choose(matches[0])}
            placeholder={`${scored.length + refused.length} exchanges`}
            autoComplete="off"
            className="h-11 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
          />
          {matches.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md">
              {matches.map((o) => (
                <li key={o.e.slug}>
                  <button
                    type="button"
                    onClick={() => choose(o)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {o.e.name}
                    {o.kind === "refused" && <span className="font-mono text-[11px] text-muted-foreground">no wallets</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q && matches.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">No exchange with proof-of-reserves matches “{query}”.</p>
          )}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">Try one</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {picks.map((slug) => {
            const o = bySlug.get(slug);
            if (!o) return null;
            const active = selected.e.slug === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => choose(o)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  active ? "border-foreground bg-foreground text-background" : "hover:border-foreground/40"
                }`}
              >
                {o.e.name}
              </button>
            );
          })}
        </div>
      </div>

      <div aria-live="polite">
        {selected.kind === "scored" ? <ExchangeCard e={selected.e} /> : <RefusalCard e={selected.e} />}
      </div>
    </div>
  );
}
