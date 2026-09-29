# Backed

**CoinMarketCap shows how much an exchange holds. Backed shows what it is made of.**

Backed runs four checks on every exchange that publishes wallet-level proof-of-reserves through the CoinMarketCap API. It marks the part of each reported total that is not backed by verified, traded, circulating supply, and it sets each exchange's futures open interest against its disclosed reserves. Every number comes from CoinMarketCap fields, and every flag links back to the fields that caused it.

Built for **Build with CMC: API Hackathon**, Data and Visualisation track. `#BuildwithCMC`

- Live demo: to be added at deployment
- Demo video: to be added at submission

## What it finds

Snapshot of 2026-09-29 04:41 UTC, free Basic plan, 111 credits:

| | |
|---|---|
| Exchanges with wallet-level reserves in the API | 71 (18 more are marked as reporting but return no wallets) |
| Reported reserves | $282.2B |
| Flagged by the checks | $2.8B, with 9 exchanges at 5% or more |
| Exchanges with more open interest than reserves | 32 of 52, carrying $111.7B of open interest on $17.0B of reserves |
| Exchanges above 10× | 21, carrying $83.5B on $2.2B |
| Of the 32 above 1×, not reporting liquidations to CMC | 31 |

Examples, each traceable to raw API rows on its exchange page:

- **LBank** reports $551M. 97.5% sits in tokens for which CoinMarketCap shows no verified circulating supply. The largest is UMM: 98.9M tokens in one LBank wallet, one market pair, `circulating_supply: 0`.
- **MEXC** holds 3.6 times the circulating supply of its own token MX. The $448M above circulating supply cannot all be customer deposits.
- **WEEX** reports $225M of reserves and $11B of open interest (49×).
- **Binance and OKX** come out 100% backed on these checks.

## The checks

| Check | Rule | Effect |
|---|---|---|
| Unverified supply | `circulating_supply` is 0 or the token is not returned | Whole holding flagged |
| Above circulating supply | balance held > `circulating_supply` | Portion above supply flagged |
| Thin market | `num_market_pairs` ≤ 2 | Whole holding flagged |
| Disclosure | open interest ÷ reserves, `porAuditStatus`, liquidation reporting, wallet count | Shown beside the result, never subtracted |

Backed value is reported reserves minus the three flags. Flags never overlap. Stablecoins, wrapped tokens and staked tokens (CoinMarketCap tags `stablecoin`, `wrapped-tokens`, `liquid-staking-derivatives`, `rehypothecated-crypto`) are only checked for unverified supply, because their value comes from redemption and their CoinMarketCap supply is often counted on one chain. There are no tunable weights. The full method is on the `/method` page.

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
npm run dev
npm test
```

`npm run snapshot` writes `data/snapshot.json` and appends to `data/history.json`. The site is built statically from those files, so the API key never reaches the browser.

```
scripts/cmc.ts        API client: rate limit, retries, call log
scripts/snapshot.ts   pipeline: map → info → assets → quotes → derivatives
src/lib/checks.ts     the checks, pure functions
src/lib/checks.test.ts
src/app/              overview, exchange pages, method, API notes
```

## Limits

| Claim | Status |
|---|---|
| Figures match CoinMarketCap API responses | Yes, recomputed independently for seven exchanges within 0.03% |
| Reserves are checked on-chain | No. Wallet lists and balances are taken from CoinMarketCap as returned |
| This is a solvency test | No. The data has no liabilities |
| Open interest is a liability | No. It is shown beside reserves, never subtracted |
| History | Recorded from 2026-09-29. CoinMarketCap returns current reserves only |

## License

MIT
