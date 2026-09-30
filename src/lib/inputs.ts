import { createHash } from "node:crypto";
import { METHOD_VERSION } from "./checks";
import { type AssetRow, assetRowProblem } from "./rows";
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
const TOKEN_NUMBERS = ["price", "circulatingSupply", "totalSupply", "selfReportedCirculatingSupply", "marketCap", "volume24h", "marketPairs"] as const;

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
    if (!Number.isInteger(e.id) || typeof e.slug !== "string" || typeof e.name !== "string") {
      problems.push(`exchange ${JSON.stringify(e.slug)} has a malformed id, slug or name`);
      continue;
    }
    const slug = e.slug.toLowerCase();
    if (ids.has(e.id) || slugs.has(slug)) problems.push(`${e.slug} appears twice`);
    ids.add(e.id);
    slugs.add(slug);
    if (!Number.isInteger(e.porAuditStatus)) problems.push(`${e.slug} porAuditStatus is not an integer`);
    if (!Array.isArray(e.assets)) problems.push(`${e.slug} has no asset list`);
    else {
      const bad = e.assets.map(assetRowProblem).find((p) => p !== null);
      if (bad) problems.push(`${e.slug} has a malformed row: ${bad}`);
      const missing = e.assets.find((r) => !inputs.tokens[String(r.currency?.crypto_id)]);
      if (missing) problems.push(`${e.slug} holds token ${missing.currency?.crypto_id} with no token data`);
    }
    if (!assetCalls.has(String(e.id))) problems.push(`${e.slug} has no successful assets call in the call log`);
    if (!isNumberOrNull(e.openInterestReported)) problems.push(`${e.slug} open interest is not a non-negative number`);
    if (!isNumberOrNull(e.spotVolumeUsd)) problems.push(`${e.slug} spot volume is not a non-negative number`);
    if (typeof e.inLiquidationResponse !== "boolean") problems.push(`${e.slug} liquidation presence is not a boolean`);
  }
  if (assetCalls.size !== ids.size) problems.push(`${assetCalls.size} assets calls logged for ${ids.size} exchanges`);

  problems.push(...tokenProblems(inputs.tokens));
  for (const c of inputs.calls) {
    if (typeof c.credits !== "number" || !Number.isFinite(c.credits) || c.credits < 0) problems.push(`call ${c.path} has invalid credits`);
    if (typeof c.errorCode !== "number" && typeof c.errorCode !== "string") problems.push(`call ${c.path} has an invalid error code`);
  }
  return problems;
}

export function tokenProblems(tokens: Record<string, Token>): string[] {
  const problems: string[] = [];
  for (const [key, t] of Object.entries(tokens)) {
    if (String(t?.id) !== key) problems.push(`token ${key} is stored under the wrong id`);
    const bad = TOKEN_NUMBERS.find((f) => !isNumberOrNull(t?.[f]));
    if (bad) problems.push(`token ${key} ${bad} is not a non-negative number`);
    if (!Array.isArray(t?.tags) || t.tags.some((x) => typeof x !== "string")) problems.push(`token ${key} tags are not a list of text`);
  }
  return problems;
}
