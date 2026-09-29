# Backed

**CoinMarketCap shows how much an exchange holds. Backed shows what it is made of.**

Backed checks every exchange that publishes wallet-level proof-of-reserves through the CoinMarketCap API. It flags the part of each reported total that rests on tokens with unverified supply, holdings larger than the circulating supply, or very thin markets, and it sets each exchange's futures open interest against its disclosed reserves. Every number comes from CoinMarketCap fields, and every flag links back to the fields that caused it.

Built for **Build with CMC: API Hackathon**, Data and Visualisation track. `#BuildwithCMC`

## What it finds

Snapshot of 2026-09-29 07:02 UTC, free Basic plan, 111 calls and 111 credits:

| | |
|---|---|
| Exchanges with wallet-level reserves in the API | 71 (18 more are listed as reporting but return no wallets) |
| Reported reserves | $284.6B |
| Flagged by the checks | $2.8B, with 8 exchanges at 5% or more. The largest single flag is USDZ at Blockfinex, $1.4B |
| Exchanges with more open interest than disclosed reserves | 32 of 52, carrying $113.6B of open interest on $17.1B of reserves |
| Exchanges above 10× | 21, carrying $85.1B on $2.2B. Ratios are largest where disclosed reserves are small |
| CoinMarketCap liquidation data | 6 of the 71 exchanges, and 1 of the 32 above 1× |

Examples, each traceable to raw API rows on its exchange page:

- **LBank** reports $551M. 97.5% sits in tokens whose circulating supply CoinMarketCap has not verified. The largest is UMM: 98.9M tokens in one LBank wallet, one market pair, `circulating_supply: 0`.
- **MEXC** holds 3.6 times the circulating supply of its own token MX. The $449M above circulating supply cannot have come from customer deposits. It is most likely MEXC's own treasury.
- **WEEX** reports $226M of reserves and $11.1B of open interest (49×).
- **Binance and OKX** pass the checks on more than 99.9%: $8.0M and $8.1M flagged against $173B and $21B.

## The checks

| Check | Rule | Effect |
|---|---|---|
| 01 Unverified supply | `circulating_supply` is 0 or the token is not returned | Whole holding flagged |
| 02 Above circulating supply | balance held > `circulating_supply` | Portion above supply flagged |
| 03 Thin market | `num_market_pairs` ≤ 2 | Whole holding flagged. In the current snapshot every such token is already caught by 01, so it flags $0 |
| 04 Open interest | open interest ÷ reserves, plus `porAuditStatus`, liquidation data and wallet count | Shown beside the result, never subtracted |

The checked value is reported reserves minus the three flags. Flags never overlap. Stablecoins, wrapped tokens and staked tokens (CoinMarketCap tags `stablecoin`, `wrapped-tokens`, `liquid-staking-derivatives`, `rehypothecated-crypto`) are only checked for unverified supply, because their value comes from redemption and their CoinMarketCap supply is often counted on one chain. There are no tunable weights. The full method is on the `/method` page.

## CoinMarketCap endpoints used

| Endpoint | Used for | Calls per refresh |
|---|---|---|
| `GET /v1/exchange/map` | All 978 active exchanges | 1 |
| `GET /v1/exchange/info` | `porStatus`, `porAuditStatus`, spot volume, 100 exchanges per call | 10 |
| `GET /v1/exchange/assets` | Wallet-level reserves per exchange | 89 |
| `GET /v2/cryptocurrency/quotes/latest` | Supply, market pairs, volume and tags for every held token, 100 per call | 9 |
| `GET /v5/exchange/derivatives/list` | Open interest per exchange | 1 |
| `GET /v5/derivatives/liquidations/exchange/list/latest` | Which exchanges report liquidations | 1 |

Every endpoint works on the free Basic plan, so the site keeps working after the event access ends.

## A real call

The UMM row behind LBank's largest flag:

```bash
curl -H "X-CMC_PRO_API_KEY: $CMC_PRO_API_KEY" \
  "https://pro-api.coinmarketcap.com/v1/exchange/assets?id=333"
```

```json
{
  "status": { "timestamp": "2026-09-29T04:43:20.504Z", "error_code": 0, "credit_count": 1 },
  "data": [
    {
      "balance": 98899479.0,
      "platform": { "symbol": "AVAX", "name": "Avalanche", "crypto_id": 5805 },
      "currency": { "symbol": "UMM", "name": "UMM", "crypto_id": 32587, "price_usd": 4.023144339181496 },
      "wallet_address": "0x873F3EE008AD7d5bb37043186db7503B57D68F75"
    }
  ]
}
```

```bash
curl -H "X-CMC_PRO_API_KEY: $CMC_PRO_API_KEY" \
  "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=32587"
```

```json
{
  "status": { "timestamp": "2026-09-29T04:43:22.440Z", "error_code": 0, "credit_count": 1 },
  "data": {
    "32587": {
      "id": 32587,
      "symbol": "UMM",
      "circulating_supply": 0,
      "self_reported_circulating_supply": 100000000,
      "total_supply": 100000000,
      "num_market_pairs": 1,
      "quote": { "USD": { "price": 4.013309700410941, "market_cap": 0, "volume_24h": 180276.30655168 } }
    }
  }
}
```

Both responses are trimmed to the fields Backed reads. Each exchange page lists the exact calls behind it.

## What the API made possible, and where it got in the way

It made possible: wallet-level reserves with prices from one endpoint, verified supply next to self-reported supply, and open interest per exchange, all on the Basic plan at about 110 credits per full refresh.

Where it got in the way, each reproduced against the live API (details on the `/api-notes` page):

1. Every exchange marked as audited returns no wallets from `exchange/assets`.
2. Reserve totals count tokens with unverified supply at full price.
3. Binance's USDS rows are mapped to crypto_id 33452 (TheStandard USD) instead of 33039 (USDS).
4. Reserve rows carry no timestamp.
5. 18 of Binance's 29 legacy Bitcoin addresses come back lowercased, which breaks base58 lookups.
6. Gate's response contains duplicate rows.
7. WOO X Pro BTC/USD reports about $12.7 trillion of open interest, with `outlier_detected: false`.
8. `funding_rate` has no settlement interval.
9. `market-pairs/latest`, which would give real depth, is not on the Basic plan.

## Run it

```bash
npm install
echo "CMC_PRO_API_KEY=your-key" > .env.local
npm run snapshot   # about 2.5 minutes, about 110 credits
npm run verify     # recompute 7 exchanges from fresh calls, about 20 credits
npm run dev
npm test
```

`npm run snapshot` writes `data/snapshot.json` and appends to `data/history.json`. The site is built statically from those files, so the API key never reaches the browser.

```
scripts/cmc.ts        API client: rate limit, retries, call log
scripts/snapshot.ts   pipeline: map → info → assets → quotes → derivatives
scripts/verify.ts     independent recompute that does not use src/lib/checks.ts
src/lib/checks.ts     the checks, pure functions
src/lib/checks.test.ts
src/app/              overview, exchange pages, method, API notes
```

## Limits

| Claim | Status |
|---|---|
| Figures match CoinMarketCap API responses | Yes. `npm run verify` re-fetched seven exchanges at 07:03 UTC and matched the snapshot within 0.32% of reserves. Prices and open interest move between runs |
| Reserves are checked on-chain | No. Wallet lists and balances are taken from CoinMarketCap as returned |
| This is a solvency test | No. The data has no liabilities |
| Open interest is a liability | No. It is shown beside reserves, never subtracted |
| History | Recorded from 2026-09-29. CoinMarketCap returns current reserves only |

## License

MIT
