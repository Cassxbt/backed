import type { Flag } from "@/lib/types";

const styles: Record<Flag | "exempt", { label: string; dot: string }> = {
  unverified: { label: "Unverified supply", dot: "bg-unverified" },
  thin: { label: "Thin market", dot: "bg-thin" },
  excess: { label: "Above circulating", dot: "bg-excess" },
  exempt: { label: "Exempt", dot: "bg-exempt" },
};

export function FlagBadge({ flag, exempt = false }: { flag: Flag | null; exempt?: boolean }) {
  const key = flag ?? (exempt ? "exempt" : null);
  if (!key) return <span className="text-muted-foreground">Not flagged</span>;
  const s = styles[key];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`size-2 rounded-[2px] ${s.dot}`} />
      {s.label}
    </span>
  );
}
