import type { ExchangeInput, ExchangeResult, Holding, HoldingResult, Token } from "./types";

export const THIN_MARKET_PAIRS = 2;

const REDEEMABLE_TAGS = ["stablecoin", "wrapped-tokens", "liquid-staking-derivatives"];

export function isRedeemable(token: Token | undefined): boolean {
  return !!token?.tags.some((t) => REDEEMABLE_TAGS.includes(t));
}

export function classifyHolding(h: Holding, token: Token | undefined): HoldingResult {
  const circ = token?.circulatingSupply ?? 0;
  const total = token?.totalSupply ?? 0;
  const redeemable = isRedeemable(token);
  const unitPrice = h.balance > 0 ? h.usd / h.balance : 0;

  const shareOfCirculating = circ > 0 ? h.balance / circ : null;
  const shareOfTotal = total > 0 ? h.balance / total : null;
  const volume = token?.volume24h ?? 0;
  const daysOfVolume = !redeemable && volume > 0 ? h.usd / volume : null;

  let flag: HoldingResult["flag"] = null;
  let flaggedUsd = 0;

  if (!token || circ <= 0) {
    flag = "unverified";
    flaggedUsd = h.usd;
  } else if (redeemable) {
    // Value comes from redemption, and CMC supply figures for multi-chain redeemables are incomplete.
  } else if ((token.marketPairs ?? 0) <= THIN_MARKET_PAIRS) {
    flag = "thin";
    flaggedUsd = h.usd;
  } else if (h.balance > circ) {
    flag = "excess";
    flaggedUsd = (h.balance - circ) * unitPrice;
  }

  return { ...h, flag, flaggedUsd, shareOfCirculating, shareOfTotal, daysOfVolume, redeemable };
}

export function checkExchange(input: ExchangeInput, tokens: Map<number, Token>): ExchangeResult {
  const holdings = input.holdings
    .map((h) => classifyHolding(h, tokens.get(h.cryptoId)))
    .sort((a, b) => b.usd - a.usd);

  const sum = (pick: (h: HoldingResult) => number) => holdings.reduce((acc, h) => acc + pick(h), 0);
  const flagged = (f: HoldingResult["flag"]) => sum((h) => (h.flag === f ? h.flaggedUsd : 0));

  const reportedUsd = sum((h) => h.usd);
  const backedUsd = reportedUsd - sum((h) => h.flaggedUsd);

  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    reportedUsd,
    backedUsd,
    backedShare: reportedUsd > 0 ? backedUsd / reportedUsd : 0,
    unverifiedUsd: flagged("unverified"),
    thinUsd: flagged("thin"),
    excessUsd: flagged("excess"),
    walletCount: input.walletCount,
    chains: [...new Set(holdings.flatMap((h) => h.chains))].sort(),
    porAuditStatus: input.porAuditStatus,
    spotVolumeUsd: input.spotVolumeUsd,
    openInterestUsd: input.openInterestUsd,
    cover: input.openInterestUsd != null && reportedUsd > 0 ? input.openInterestUsd / reportedUsd : null,
    reportsLiquidations: input.reportsLiquidations,
    duplicateRowsRemoved: input.duplicateRowsRemoved,
    holdings,
  };
}
