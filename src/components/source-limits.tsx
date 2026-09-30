import { snapshot } from "@/lib/data";

const DOC = "https://coinmarketcap.com/api/documentation/pro-api-reference/exchange";

export function SourceLimits() {
  const conflicts = snapshot.exchanges.reduce((n, e) => n + e.conflictingRows, 0);
  const items = [
    "CoinMarketCap lists only wallets holding at least $100,000, so smaller wallets are not counted.",
    "Balances may be delayed, and reserve rows carry no timestamp, so balances and prices are not from one moment.",
    "Exchanges supply the wallet data. CoinMarketCap states that it does not verify it.",
    `${snapshot.noWallets.length} exchanges listed as reporting return no wallets and are not scored.`,
    `Duplicate rows are dropped. ${conflicts} wallet-token pairs came back with different balances or prices; the larger balance, then the higher price, is kept and counted.`,
  ];

  return (
    <div className="rounded-xl border bg-card p-6">
      <p className="text-sm font-medium">What the source covers</p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i} className="text-pretty">
            {i}
          </li>
        ))}
      </ul>
      <a href={DOC} className="mt-4 inline-flex text-xs underline decoration-border underline-offset-4 hover:text-foreground">
        CoinMarketCap exchange API documentation
      </a>
    </div>
  );
}
