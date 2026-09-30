# Backed

**Exchange reserves, checked against CoinMarketCap's own data.**

CoinMarketCap already shows what each exchange's disclosed wallets hold. Backed checks every holding against CoinMarketCap's supply, market and derivatives data, and shows which part of the reported figure that data does not support. Every number comes from CoinMarketCap fields, every flag links to the fields that caused it, and every total replays offline.

Built for **Build with CMC: API Hackathon**, Data and Visualisation track. `#BuildwithCMC`

## What it finds

Snapshot of 2026-09-30, 06:33 to 06:36 UTC, method `checks-v4`, free Basic plan, 111 calls and 111 credits.

| | |
|---|---|
| Exchanges with wallet-level reserves in the API | 71. Another 18 are listed as reporting but return no wallets, and are not scored |
| Reported reserves | $282.9B |
| Flagged by the checks | $2.84B. 10 exchanges have 1% or more flagged. The largest single flag is USDZ at Blockfinex, $1.38B |
| Exempt, not evaluated | $82.3B (29%): stablecoins and wrapped or staked tokens |
| Exchanges with more open interest than disclosed reserves | 32 of 51 with data, $97.9B of open interest on $17.0B of reserves |
| Above 10× | 20 exchanges, $69.9B on $2.0B. Ratios are largest where disclosed reserves are small |
| CoinMarketCap liquidation data | 6 of the 71 exchanges, and 1 of the 32 above 1× |

Examples, each traceable to raw API rows on its exchange page:

- **LBank** reports $552M. 97.5% sits in tokens whose circulating supply CoinMarketCap has not verified. The largest is UMM: 98.9M tokens in one LBank wallet, one market pair, `circulating_supply: 0`.
- **MEXC** discloses 3.6 times CoinMarketCap's circulating-supply figure for MX. The $447M above it is flagged as a supply discrepancy. The datasets can differ in scope or timing, and ownership cannot be inferred from this alone.
- **WEEX** reports $225M of reserves and $11.0B of open interest (49×).
- **Binance and OKX** have $7.9M and $7.4M flagged, under 0.1% of $172B and $21B. About a third of each is exempt. Not flagged is not the same as verified.

## The checks

Every holding lands in exactly one bucket: flagged, exempt, or not flagged.

| # | Check | Rule | Effect |
|---|---|---|---|
| 01 | Unverified supply | `circulating_supply` is 0, or the token is not returned | Whole holding flagged, as an evidence gap |
| 02 | Above circulating supply | balance held > `circulating_supply` | Portion above flagged, as a discrepancy. No ownership inferred |
| 03 | Thin market | `num_market_pairs` ≤ 2. A missing count is unknown | Whole holding flagged. In this snapshot every such token is already caught by 01, so it flags $0 |
| 04 | Exempt, not evaluated | tags `stablecoin`, `wrapped-tokens`, `liquid-staking-derivatives`, `rehypothecated-crypto` | Skips 02 and 03, still subject to 01, shown as exempt, never as passing |

Open interest divided by reported reserves is shown beside the result and never subtracted. CoinMarketCap reports open interest of exactly 0 for some exchanges with billions in derivatives volume, so Backed treats 0 as no data. There are no tunable weights.

## What the source covers

From the [CoinMarketCap exchange API documentation](https://coinmarketcap.com/api/documentation/pro-api-reference/exchange): only wallets holding at least $100,000 are listed, balances may be delayed, and CoinMarketCap does not verify the wallet data exchanges supply. Reserve rows carry no timestamp, so balances and prices are not from one moment. Backed is not a solvency, backing, ownership or safety assessment.

## CoinMarketCap endpoints used

| Endpoint | Used for | Calls per refresh |
|---|---|---|
| `GET /v1/exchange/map` | All 978 active exchanges | 1 |
| `GET /v1/exchange/info` | `porStatus`, `porAuditStatus`, spot volume, 100 exchanges per call | 10 |
| `GET /v1/exchange/assets` | Wallet-level reserves per exchange | 89 |
| `GET /v2/cryptocurrency/quotes/latest` | Supply, market pairs, volume and tags for every held token, 100 per call | 9 |
| `GET /v5/exchange/derivatives/list` | Open interest per exchange | 1 |
| `GET /v5/derivatives/liquidations/exchange/list/latest` | Which exchanges CoinMarketCap has liquidation data for | 1 |

Every endpoint works on the free Basic plan.

## A real call

The UMM row behind LBank's largest flag, captured 2026-09-29 04:43 UTC:

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

## Proof

| Command | Needs a key | What it does | Fails when |
|---|---|---|---|
| `npm test` | No | 33 unit tests, including replay of the shipped snapshot and three tamper cases | Any rule, normalisation or replay test breaks |
| `npm run replay` | No | Recomputes all 71 exchanges from `data/snapshot.json`, which ships every holding | Any stored total differs from the replay, or the buckets do not sum to the reported figure |
| `npm run verify` | Yes, about 20 credits | Re-fetches 7 exchanges and recomputes them with separate code that does not import the checks | An exchange is missing, or reported, flagged or exempt value differs by more than 1% of reserves |
| `npm run snapshot` | Yes, about 110 credits | Rebuilds the data | Any request fails after retries, the exchange list hits the page limit, or a balance or price is negative or non-finite. Nothing is written |

At 2026-09-30 06:36 UTC, `npm run verify` passed against this snapshot. The site shows the verify result only when it matches the current snapshot and method version.

## What the API made possible, and where it got in the way

It made possible: wallet-level reserves with prices from one endpoint, verified supply next to self-reported supply, and open interest per exchange, all on the Basic plan at about 110 credits per full refresh.

Where it got in the way, each reproduced against the live API (details on the `/api-notes` page):

1. Every exchange marked as audited returns no wallets from `exchange/assets`.
2. Reserve totals count tokens with unverified supply at full price.
3. Binance's USDS rows are mapped to crypto_id 33452 (TheStandard USD) instead of 33039 (USDS).
4. Reserve rows carry no timestamp, and the documented delay cannot be measured.
5. 18 of Binance's 29 legacy Bitcoin addresses come back lowercased, which breaks base58 lookups.
6. Responses contain duplicate rows, and some wallet and token pairs come back with two different balances.
7. `open_interest_usd` is exactly 0 for exchanges with billions in derivatives volume, and changes between refreshes.
8. WOO X Pro BTC/USD reports about $12.7 trillion of open interest, with `outlier_detected: false`.
9. `funding_rate` has no settlement interval.
10. `market-pairs/latest`, which would give real depth, is not on the Basic plan.

## Run it

```bash
npm install
echo "CMC_PRO_API_KEY=your-key" > .env.local
npm run snapshot
npm run replay
npm run verify
npm run dev
```

The site is built statically from `data/`, so the API key never reaches the browser.

```
scripts/cmc.ts        API client: rate limit, timeouts, retries, call log
scripts/snapshot.ts   pipeline: map → info → assets → quotes → derivatives
scripts/verify.ts     live recompute with separate code
scripts/replay.ts     offline recompute of every exchange
src/lib/checks.ts     the checks, pure functions
src/lib/rows.ts       duplicate and conflict handling, input validation
src/lib/replay.ts     replay used by the tests and the replay command
src/app/              overview, exchange pages, method, API notes
```

## License

MIT
