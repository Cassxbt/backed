import type { ExchangeResult, HoldingResult, Token } from "./types";

export type WalletRow = { address: string; chain: string; balance: number };

export type SnapshotHolding = HoldingResult & { rows?: WalletRow[] };

export type SnapshotExchange = Omit<ExchangeResult, "holdings"> & {
  holdings: SnapshotHolding[];
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
  methodVersion: string;
  startedAt: string;
  generatedAt: string;
  credits: number;
  exchangesListed: number;
  porReporting: number;
  exchanges: SnapshotExchange[];
  noWallets: { slug: string; name: string; porAuditStatus: number }[];
  tokens: Record<string, Token>;
  calls: Call[];
};

export type HistoryPoint = {
  at: string;
  methodVersion: string;
  exchanges: Record<string, { reported: number; flagged: number; exempt: number; cover: number | null }>;
};
