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
  openInterestUsd: number | null;
  reportsLiquidations: boolean;
  holdings: Holding[];
  walletCount: number;
  duplicateRowsRemoved: number;
};

export type Flag = "unverified" | "thin" | "excess";

export type HoldingResult = Holding & {
  flag: Flag | null;
  flaggedUsd: number;
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
  backedUsd: number;
  backedShare: number;
  unverifiedUsd: number;
  thinUsd: number;
  excessUsd: number;
  walletCount: number;
  chains: string[];
  porAuditStatus: number;
  spotVolumeUsd: number | null;
  openInterestUsd: number | null;
  cover: number | null;
  reportsLiquidations: boolean;
  duplicateRowsRemoved: number;
  holdings: HoldingResult[];
};
