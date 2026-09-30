export type Buckets = {
  reported: number;
  passed: number;
  exempt: number;
  unverified: number;
  thin: number;
  excess: number;
};

export const BUCKETS = [
  { key: "unverified", label: "Unverified supply", swatch: "bg-unverified" },
  { key: "excess", label: "Above circulating supply", swatch: "bg-excess" },
  { key: "thin", label: "Thin market", swatch: "bg-thin" },
  { key: "exempt", label: "Exempt, not evaluated", swatch: "bg-exempt" },
  { key: "passed", label: "Not flagged", swatch: "bg-backed" },
] as const;

export const flaggedOf = (b: Buckets) => b.unverified + b.thin + b.excess;

export function StackBar({ b, className = "h-2.5" }: { b: Buckets; className?: string }) {
  return (
    <span className={`flex gap-[2px] ${className}`}>
      {BUCKETS.map((s) =>
        b[s.key] > 0 ? (
          <span
            key={s.key}
            className={`h-full first:rounded-l-[3px] last:rounded-r-[3px] ${s.swatch}`}
            style={{ width: `${(b[s.key] / b.reported) * 100}%`, minWidth: 2 }}
          />
        ) : null,
      )}
    </span>
  );
}

export function Legend({ rows }: { rows: Buckets[] }) {
  const present = BUCKETS.filter((s) => rows.some((r) => r[s.key] > 0));
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {present.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-[2px] ${s.swatch}`} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
