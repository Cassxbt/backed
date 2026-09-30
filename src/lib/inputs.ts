import { createHash } from "node:crypto";
import { METHOD_VERSION } from "./checks";
import type { AssetRow } from "./rows";
import type { Call } from "./snapshot";
import type { Token } from "./types";

// Everything the checks read, as CMC returned it. snapshot.json is a pure function of this file.
export type ExchangeSource = {
  id: number;
  slug: string;
  name: string;
  porAuditStatus: number;
  spotVolumeUsd: number | null;
  // null when the exchange is absent from the derivatives list or CMC gave no figure; 0 is kept as reported.
  openInterestReported: number | null;
  inLiquidationResponse: boolean;
  assets: AssetRow[];
};

export type Inputs = {
  methodVersion: string;
  startedAt: string;
  capturedAt: string;
  exchangesListed: number;
  exchanges: ExchangeSource[];
  tokens: Record<string, Token>;
  calls: Call[];
};

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

const isNumberOrNull = (x: unknown) => x === null || (typeof x === "number" && Number.isFinite(x) && x >= 0);

export function validateInputs(inputs: Inputs): string[] {
  const problems: string[] = [];
  if (inputs.methodVersion !== METHOD_VERSION) problems.push(`inputs method ${inputs.methodVersion}, this code is ${METHOD_VERSION}`);
  if (!Array.isArray(inputs.exchanges) || inputs.exchanges.length === 0) return [...problems, "inputs list no exchanges"];
  if (!Number.isInteger(inputs.exchangesListed) || inputs.exchangesListed < inputs.exchanges.length) {
    problems.push(`exchangesListed ${inputs.exchangesListed} is below the ${inputs.exchanges.length} exchanges checked`);
  }

  const assetCalls = new Set(
    inputs.calls.filter((c) => c.path === "/v1/exchange/assets" && String(c.errorCode) === "0").map((c) => c.params.id),
  );
  const ids = new Set<number>();
  const slugs = new Set<string>();
  for (const e of inputs.exchanges) {
    if (ids.has(e.id) || slugs.has(e.slug)) problems.push(`${e.slug} appears twice`);
    ids.add(e.id);
    slugs.add(e.slug);
    if (!Array.isArray(e.assets)) problems.push(`${e.slug} has no asset list`);
    if (!assetCalls.has(String(e.id))) problems.push(`${e.slug} has no successful assets call in the call log`);
    if (!isNumberOrNull(e.openInterestReported)) problems.push(`${e.slug} open interest is not a non-negative number`);
    if (!isNumberOrNull(e.spotVolumeUsd)) problems.push(`${e.slug} spot volume is not a non-negative number`);
    if (typeof e.inLiquidationResponse !== "boolean") problems.push(`${e.slug} liquidation presence is not a boolean`);
  }
  if (assetCalls.size !== ids.size) problems.push(`${assetCalls.size} assets calls logged for ${ids.size} exchanges`);

  for (const [key, t] of Object.entries(inputs.tokens)) {
    if (String(t.id) !== key) problems.push(`token ${key} is stored under the wrong id`);
  }
  return problems;
}
