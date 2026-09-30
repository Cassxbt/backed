export type AssetRow = {
  wallet_address: string;
  balance: number;
  platform: { crypto_id: number; symbol: string; name: string };
  currency: { crypto_id: number; symbol: string; price_usd: number | null };
};

const EVM_ADDRESS = /^0x[0-9a-f]{40}$/i;

// EVM addresses are case-insensitive, including the 0X prefix; Base58 and others are not, so only EVM is folded.
export function walletKey(address: string): string {
  return EVM_ADDRESS.test(address) ? address.toLowerCase() : address;
}

export function assetRowProblem(r: unknown): string | null {
  const x = r as AssetRow;
  const price = x?.currency?.price_usd;
  if (typeof x?.wallet_address !== "string") return "wallet_address is not a string";
  if (typeof x.balance !== "number" || !Number.isFinite(x.balance) || x.balance < 0) return `invalid balance ${x.balance}`;
  if (!Number.isInteger(x.platform?.crypto_id) || !Number.isInteger(x.currency?.crypto_id)) return "missing crypto_id";
  if (price !== null && (typeof price !== "number" || !Number.isFinite(price) || price < 0)) return `invalid price ${price}`;
  return null;
}

// Total order used to pick one row from a group, so the result never depends on the order CMC returns rows in:
// larger balance, then higher price (missing lowest), then the address and chain as text.
function compare(a: AssetRow, b: AssetRow): number {
  return (
    a.balance - b.balance ||
    (a.currency.price_usd ?? -1) - (b.currency.price_usd ?? -1) ||
    (a.wallet_address < b.wallet_address ? -1 : a.wallet_address > b.wallet_address ? 1 : 0) ||
    (a.platform.symbol < b.platform.symbol ? -1 : a.platform.symbol > b.platform.symbol ? 1 : 0)
  );
}

// Rows for one wallet, chain and token are duplicates when balance and price agree; if any disagree the group is one conflict.
export function normalizeRows(raw: AssetRow[]) {
  const groups = new Map<string, AssetRow[]>();
  for (const r of raw) {
    const problem = assetRowProblem(r);
    if (problem) throw new Error(`${problem} for ${r?.currency?.symbol} in ${r?.wallet_address}`);
    const key = `${walletKey(r.wallet_address)}|${r.platform.crypto_id}|${r.currency.crypto_id}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const rows: AssetRow[] = [];
  let duplicates = 0;
  let conflicts = 0;
  for (const group of groups.values()) {
    const values = new Set(group.map((r) => `${r.balance}|${r.currency.price_usd}`));
    duplicates += group.length - values.size;
    if (values.size > 1) conflicts++;
    rows.push(group.reduce((best, r) => (compare(r, best) > 0 ? r : best)));
  }
  return { rows, duplicates, conflicts };
}
