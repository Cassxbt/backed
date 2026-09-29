import type { ExchangeResult, HoldingResult, Token } from "./types";

export type WalletRow = { address: string; chain: string; balance: number };

export type SnapshotHolding = HoldingResult & { rows?: WalletRow[] };

export type SnapshotExchange = Omit<ExchangeResult, "holdings"> & {
  holdings: SnapshotHolding[];
  otherHoldings: { count: number; usd: number; flaggedUsd: number };
  unpricedRows: number;
};

export type Call = {
  path: string;
  params: Record<string, string>;
  credits: number;
  errorCode: number | string;
  at: string;
};

export type Snapshot = {
  generatedAt: string;
  credits: number;
  exchangesListed: number;
  porReporting: number;
  exchanges: SnapshotExchange[];
  tokens: Record<string, Token>;
  calls: Call[];
  failures: { slug: string; error: string }[];
};

export type HistoryPoint = {
  at: string;
  exchanges: Record<string, { reported: number; backed: number; cover: number | null }>;
};
