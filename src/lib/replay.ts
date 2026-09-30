import { type Receipt, buildExchange, buildSnapshot, historyPoint, tokenMap } from "./build";
import { METHOD_VERSION } from "./checks";
import { type Inputs, sha256, tokenProblems, validateInputs } from "./inputs";
import { assetRowProblem } from "./rows";
import type { HistoryPoint, Snapshot } from "./snapshot";

const MAX_DIFFS = 20;
const RECEIPT_KEYS = ["receipt", "methodVersion", "inputsSha256", "capturedAt", "source", "tokens", "result"];

const brief = (x: unknown) => {
  const text = JSON.stringify(x) ?? "undefined";
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

// Paths where two JSON values differ. Numbers must match exactly: the rebuild runs the same arithmetic on the same inputs.
export function diff(expected: unknown, found: unknown, labels = ["rebuilt", "stored"], path = "", out: string[] = []): string[] {
  if (out.length >= MAX_DIFFS) return out;
  const [want, got] = labels;
  if (typeof expected !== "object" || typeof found !== "object" || expected === null || found === null) {
    if (!Object.is(expected, found)) out.push(`${path || "(root)"}: ${got} ${brief(found)}, ${want} ${brief(expected)}`);
    return out;
  }
  if (Array.isArray(expected) !== Array.isArray(found)) {
    out.push(`${path}: shape differs`);
    return out;
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(found)]);
  for (const k of keys) {
    diff((expected as Record<string, unknown>)[k], (found as Record<string, unknown>)[k], labels, path ? `${path}.${k}` : k, out);
  }
  return out;
}

const roundTrip = (x: unknown) => JSON.parse(JSON.stringify(x));

function attempt<T>(build: () => T): T | string {
  try {
    return build();
  } catch (err) {
    return `rebuild failed: ${(err as Error).message}`;
  }
}

// Proves the published snapshot is exactly what this method computes from the captured inputs.
// It does not prove the inputs are what CMC served; scripts/verify.ts checks a sample against the live API.
export function replay(inputsText: string, snapshotText: string, historyText?: string): string[] {
  const inputs: Inputs = JSON.parse(inputsText);
  const stored: Snapshot = JSON.parse(snapshotText);
  const inputsSha256 = sha256(inputsText);

  const problems: string[] = [];
  if (stored.methodVersion !== METHOD_VERSION) problems.push(`snapshot method ${stored.methodVersion}, this code is ${METHOD_VERSION}`);
  if (stored.inputsSha256 !== inputsSha256) problems.push(`inputs hash ${inputsSha256} does not match the snapshot's ${stored.inputsSha256}`);
  problems.push(...validateInputs(inputs));
  if (problems.length > 0) return problems;

  const rebuilt = attempt(() => buildSnapshot(inputs, inputsSha256));
  if (typeof rebuilt === "string") return [rebuilt];
  problems.push(...diff(roundTrip(rebuilt), stored));

  if (historyText !== undefined) {
    const history: HistoryPoint[] = JSON.parse(historyText);
    problems.push(...diff(roundTrip(historyPoint(rebuilt)), history.at(-1)).map((p) => `history: ${p}`));
  }
  return problems;
}

export type ReceiptCheck = { problems: string[]; linked: boolean };

// Without the full inputs, a receipt can only show that its result follows from the rows inside it. With them,
// it must also match the inputs the snapshot was built from, so a forged or stale receipt fails.
export function replayReceipt(r: Receipt, inputsText?: string): ReceiptCheck {
  const problems: string[] = [];
  if (r.receipt !== "backed-exchange-v1") problems.push(`unknown receipt format ${r.receipt}`);
  if (r.methodVersion !== METHOD_VERSION) problems.push(`receipt method ${r.methodVersion}, this code is ${METHOD_VERSION}`);
  const extra = Object.keys(r).filter((k) => !RECEIPT_KEYS.includes(k));
  if (extra.length > 0) problems.push(`unknown receipt fields: ${extra.join(", ")}`);
  if (!Array.isArray(r.source?.assets)) problems.push("receipt has no asset rows");
  if (problems.length > 0) return { problems, linked: false };

  problems.push(...tokenProblems(r.tokens));
  const bad = r.source.assets.map(assetRowProblem).find((p) => p !== null);
  if (bad) problems.push(`malformed row: ${bad}`);
  if (problems.length > 0) return { problems, linked: false };

  const rebuilt = attempt(() => buildExchange(r.source, tokenMap(r.tokens)));
  if (typeof rebuilt === "string") return { problems: [rebuilt], linked: false };
  problems.push(...diff(roundTrip(rebuilt), r.result));

  if (inputsText === undefined) return { problems, linked: false };
  const inputsSha256 = sha256(inputsText);
  if (inputsSha256 !== r.inputsSha256) {
    problems.push(`receipt names inputs ${r.inputsSha256.slice(0, 12)}, local data/inputs.json is ${inputsSha256.slice(0, 12)}`);
    return { problems, linked: false };
  }
  const inputs: Inputs = JSON.parse(inputsText);
  if (r.capturedAt !== inputs.capturedAt) problems.push(`receipt capture time ${r.capturedAt}, inputs ${inputs.capturedAt}`);
  const labels = ["inputs", "receipt"];
  problems.push(...diff(inputs.exchanges.find((e) => e.id === r.source.id), r.source, labels).map((p) => `source: ${p}`));
  const held = new Set(r.source.assets.map((a) => String(a.currency.crypto_id)));
  const extraTokens = Object.keys(r.tokens).filter((id) => !held.has(id));
  if (extraTokens.length > 0) problems.push(`receipt carries tokens it does not hold: ${extraTokens.join(", ")}`);
  for (const id of held) problems.push(...diff(inputs.tokens[id], r.tokens[id], labels).map((p) => `token ${id}: ${p}`));
  return { problems, linked: true };
}
