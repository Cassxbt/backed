export type AssetRow = {
  wallet_address: string;
  balance: number;
  platform: { crypto_id: number; symbol: string; name: string };
  currency: { crypto_id: number; symbol: string; price_usd: number | null };
};

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

// EVM addresses are case-insensitive; Base58 and others are not, so only EVM is folded.
export function walletKey(address: string): string {
  return EVM_ADDRESS.test(address) ? address.toLowerCase() : address;
}

// Rank used to pick one row from a conflict, so the result does not depend on the order CMC returns rows in.
function rank(r: AssetRow): [number, number] {
  return [r.balance, r.currency.price_usd ?? -1];
}

function wins(a: AssetRow, b: AssetRow) {
  const [ab, ap] = rank(a);
  const [bb, bp] = rank(b);
  return ab > bb || (ab === bb && ap > bp);
}

export function normalizeRows(raw: AssetRow[]) {
  const byKey = new Map<string, AssetRow>();
  let duplicates = 0;
  let conflicts = 0;

  for (const r of raw) {
    const price = r.currency.price_usd;
    if (!Number.isFinite(r.balance) || r.balance < 0) {
      throw new Error(`invalid balance for ${r.currency.symbol} in ${r.wallet_address}`);
    }
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      throw new Error(`invalid price for ${r.currency.symbol}`);
    }

    const key = `${walletKey(r.wallet_address)}|${r.platform.crypto_id}|${r.currency.crypto_id}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
    } else if (prev.balance === r.balance && prev.currency.price_usd === price) {
      duplicates++;
    } else {
      // Two observations for one wallet and token cannot both be current. Keep the larger balance, then the higher price,
      // so the reported total is not understated and the choice is the same whatever order the rows arrive in.
      conflicts++;
      if (wins(r, prev)) byKey.set(key, r);
    }
  }

  return { rows: [...byKey.values()], duplicates, conflicts };
}
