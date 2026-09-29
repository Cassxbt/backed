import type { Flag } from "@/lib/types";

const styles: Record<Flag, { label: string; dot: string }> = {
  unverified: { label: "Unverified supply", dot: "bg-unverified" },
  thin: { label: "Thin market", dot: "bg-thin" },
  excess: { label: "Above circulating", dot: "bg-excess" },
};

export function FlagBadge({ flag }: { flag: Flag | null }) {
  if (!flag) return <span className="text-muted-foreground">—</span>;
  const s = styles[flag];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`size-2 rounded-[2px] ${s.dot}`} />
      {s.label}
    </span>
  );
}
