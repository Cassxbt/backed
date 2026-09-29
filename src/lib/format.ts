export function usd(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(abs >= 1e11 ? 0 : 1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null) return "—";
  const s = (n * 100).toFixed(digits);
  if (n < 1 && Number(s) >= 100) return `>${(100 - 10 ** -digits).toFixed(digits)}%`;
  if (n > 0 && Number(s) === 0) return `<${(10 ** -digits).toFixed(digits)}%`;
  return `${s}%`;
}

export function ratio(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 100) return `${n.toFixed(0)}×`;
  if (n >= 10) return `${n.toFixed(1)}×`;
  return `${n.toFixed(2)}×`;
}

export function num(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);
}

export function days(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1) return "<1 day";
  return `${num(Math.round(n))} days`;
}

export function utc(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
