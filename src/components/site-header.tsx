import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#findings", label: "Findings" },
  { href: "/#check", label: "Check an exchange" },
  { href: "/#proof", label: "Proof" },
  { href: "/api-notes", label: "API notes" },
];

export function SiteHeader({ snapshotLabel }: { snapshotLabel: string }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-[5px] bg-foreground font-display text-sm text-background">
            B
          </span>
          <span className="font-medium tracking-tight">Backed</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 text-sm md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground sm:flex">
            <span className="size-1.5 rounded-full bg-excess" />
            {snapshotLabel}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
