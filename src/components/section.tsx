import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{children}</p>;
}

export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  aside,
}: {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t py-16 sm:py-20">
      <div className={aside ? "grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16" : "max-w-3xl"}>
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">{title}</h2>
          {lead && <div className={`mt-5 text-pretty text-muted-foreground ${aside ? "max-w-md" : "max-w-2xl"}`}>{lead}</div>}
        </div>
        {aside}
      </div>
      {children && <div className="mt-12">{children}</div>}
    </section>
  );
}
