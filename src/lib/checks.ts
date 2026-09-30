import type { ExchangeInput, ExchangeResult, Holding, HoldingResult, Token } from "./types";

export const METHOD_VERSION = "checks-v6";
export const THIN_MARKET_PAIRS = 2;

const REDEEMABLE_TAGS = ["stablecoin", "wrapped-tokens", "liquid-staking-derivatives", "rehypothecated-crypto"];

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
  let exempt = false;
  const notEvaluated: HoldingResult["notEvaluated"] = [];

  if (!token || circ <= 0) {
    flag = "unverified";
    flaggedUsd = h.usd;
  } else if (redeemable) {
    // Value depends on redemption, which market data cannot test, and CMC supply for multi-chain redeemables is incomplete.
    exempt = true;
    notEvaluated.push("excess", "thin");
  } else if (token.marketPairs != null && token.marketPairs <= THIN_MARKET_PAIRS) {
    flag = "thin";
    flaggedUsd = h.usd;
  } else if (h.balance > circ) {
    flag = "excess";
    flaggedUsd = (h.balance - circ) * unitPrice;
  } else if (token.marketPairs == null) {
    notEvaluated.push("thin");
  }

  return { ...h, flag, flaggedUsd, exempt, notEvaluated, shareOfCirculating, shareOfTotal, daysOfVolume, redeemable };
}

export function checkExchange(input: ExchangeInput, tokens: Map<number, Token>): ExchangeResult {
  const holdings = input.holdings
    .map((h) => classifyHolding(h, tokens.get(h.cryptoId)))
    .sort((a, b) => b.usd - a.usd);

  const sum = (pick: (h: HoldingResult) => number) => holdings.reduce((acc, h) => acc + pick(h), 0);
  const flagged = (f: HoldingResult["flag"]) => sum((h) => (h.flag === f ? h.flaggedUsd : 0));

  const reportedUsd = sum((h) => h.usd);
  const exemptUsd = sum((h) => (h.exempt ? h.usd : 0));
  const passedUsd = reportedUsd - exemptUsd - sum((h) => h.flaggedUsd);
  // CMC reports exactly 0 for exchanges with billions in derivatives volume, so a reported 0 is kept as a fact but gives no ratio.
  const openInterestUsd = input.openInterestReported || null;

  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    reportedUsd,
    passedUsd,
    passedShare: reportedUsd > 0 ? passedUsd / reportedUsd : 0,
    exemptUsd,
    unverifiedUsd: flagged("unverified"),
    thinUsd: flagged("thin"),
    excessUsd: flagged("excess"),
    walletCount: input.walletCount,
    chains: [...new Set(holdings.flatMap((h) => h.chains))].sort(),
    porAuditStatus: input.porAuditStatus,
    spotVolumeUsd: input.spotVolumeUsd,
    openInterestUsd,
    openInterestReportedZero: input.openInterestReported === 0,
    cover: openInterestUsd != null && reportedUsd > 0 ? openInterestUsd / reportedUsd : null,
    inLiquidationResponse: input.inLiquidationResponse,
    duplicateRowsRemoved: input.duplicateRowsRemoved,
    conflictingRows: input.conflictingRows,
    holdings,
  };
}
