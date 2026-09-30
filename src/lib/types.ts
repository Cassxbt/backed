export type Token = {
  id: number;
  symbol: string;
  name: string;
  price: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  selfReportedCirculatingSupply: number | null;
  marketCap: number | null;
  volume24h: number | null;
  marketPairs: number | null;
  tags: string[];
};

export type Holding = {
  cryptoId: number;
  symbol: string;
  balance: number;
  usd: number;
  wallets: number;
  chains: string[];
};

export type ExchangeInput = {
  id: number;
  slug: string;
  name: string;
  porAuditStatus: number;
  spotVolumeUsd: number | null;
  openInterestReported: number | null;
  inLiquidationResponse: boolean;
  holdings: Holding[];
  walletCount: number;
  duplicateRowsRemoved: number;
  conflictingRows: number;
};

export type Flag = "unverified" | "thin" | "excess";

export type Check = "excess" | "thin";

export type HoldingResult = Holding & {
  flag: Flag | null;
  flaggedUsd: number;
  exempt: boolean;
  notEvaluated: Check[];
  shareOfCirculating: number | null;
  shareOfTotal: number | null;
  daysOfVolume: number | null;
  redeemable: boolean;
};

export type ExchangeResult = {
  id: number;
  slug: string;
  name: string;
  reportedUsd: number;
  passedUsd: number;
  passedShare: number;
  exemptUsd: number;
  unverifiedUsd: number;
  thinUsd: number;
  excessUsd: number;
  walletCount: number;
  chains: string[];
  porAuditStatus: number;
  spotVolumeUsd: number | null;
  openInterestUsd: number | null;
  openInterestReportedZero: boolean;
  cover: number | null;
  inLiquidationResponse: boolean;
  duplicateRowsRemoved: number;
  conflictingRows: number;
  holdings: HoldingResult[];
};
