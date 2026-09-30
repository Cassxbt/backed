import { type Receipt, buildExchange, buildSnapshot, historyPoint, tokenMap } from "./build";
import { METHOD_VERSION } from "./checks";
import { type Inputs, sha256, validateInputs } from "./inputs";
import type { HistoryPoint, Snapshot } from "./snapshot";

const MAX_DIFFS = 20;

const brief = (x: unknown) => {
  const text = JSON.stringify(x) ?? "undefined";
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

// Paths where two JSON values differ. Numbers must match exactly: the rebuild runs the same arithmetic on the same inputs.
export function diff(a: unknown, b: unknown, path = "", out: string[] = []): string[] {
  if (out.length >= MAX_DIFFS) return out;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    if (!Object.is(a, b)) out.push(`${path || "(root)"}: stored ${brief(b)}, rebuilt ${brief(a)}`);
    return out;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    out.push(`${path}: shape differs`);
    return out;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k, out);
  return out;
}

const roundTrip = (x: unknown) => JSON.parse(JSON.stringify(x));

// Proves the published snapshot is exactly what this method computes from the captured CMC responses.
// It does not prove the responses are what CMC served; scripts/verify.ts checks a sample against the live API.
export function replay(inputsText: string, snapshotText: string, historyText?: string): string[] {
  const inputs: Inputs = JSON.parse(inputsText);
  const stored: Snapshot = JSON.parse(snapshotText);
  const inputsSha256 = sha256(inputsText);

  const problems: string[] = [];
  if (stored.methodVersion !== METHOD_VERSION) problems.push(`snapshot method ${stored.methodVersion}, this code is ${METHOD_VERSION}`);
  if (stored.inputsSha256 !== inputsSha256) problems.push(`inputs hash ${inputsSha256} does not match the snapshot's ${stored.inputsSha256}`);
  problems.push(...validateInputs(inputs));
  if (problems.length > 0) return problems;

  const rebuilt = buildSnapshot(inputs, inputsSha256);
  problems.push(...diff(roundTrip(rebuilt), stored));

  if (historyText !== undefined) {
    const history: HistoryPoint[] = JSON.parse(historyText);
    problems.push(...diff(roundTrip(historyPoint(rebuilt)), history.at(-1)).map((p) => `history: ${p}`));
  }
  return problems;
}

export function replayReceipt(r: Receipt, inputsText?: string): { problems: string[]; linked: boolean } {
  const problems: string[] = [];
  if (r.receipt !== "backed-exchange-v1") problems.push(`unknown receipt format ${r.receipt}`);
  if (r.methodVersion !== METHOD_VERSION) problems.push(`receipt method ${r.methodVersion}, this code is ${METHOD_VERSION}`);
  if (problems.length > 0) return { problems, linked: false };

  for (const [key, t] of Object.entries(r.tokens)) {
    if (String(t.id) !== key) problems.push(`token ${key} is stored under the wrong id`);
  }
  problems.push(...diff(roundTrip(buildExchange(r.source, tokenMap(r.tokens))), r.result));

  // With the full inputs file, also prove the receipt's rows and token data are the ones the snapshot was built from.
  if (inputsText === undefined || sha256(inputsText) !== r.inputsSha256) return { problems, linked: false };
  const inputs: Inputs = JSON.parse(inputsText);
  const source = inputs.exchanges.find((e) => e.id === r.source.id);
  problems.push(...diff(source, r.source).map((p) => `source: ${p}`));
  for (const id of new Set(r.source.assets.map((a) => String(a.currency.crypto_id)))) {
    problems.push(...diff(inputs.tokens[id], r.tokens[id]).map((p) => `token ${id}: ${p}`));
  }
  return { problems, linked: true };
}
