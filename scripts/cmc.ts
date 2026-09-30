import type { Call } from "../src/lib/snapshot";

const BASE = "https://pro-api.coinmarketcap.com";
const ATTEMPTS = 4;

type Status = { error_code?: number | string; error_message?: string | null; credit_count?: number };

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Cmc {
  calls: Call[] = [];
  private last = 0;

  constructor(
    private key: string,
    private timing = { spacingMs: 1300, retryMs: 5000, timeoutMs: 30_000 },
  ) {
    if (!key) throw new Error("CMC_PRO_API_KEY is not set");
  }

  get credits() {
    return this.calls.reduce((n, c) => n + c.credits, 0);
  }

  // Resolves only for a well-formed CMC envelope with error_code 0 and a data field. Anything else throws,
  // so a proxy page, a truncated body or an empty 200 can never be read as "no wallets" or "no tokens".
  async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const wait = this.last + this.timing.spacingMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.last = Date.now();

    const query = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]));
    const url = `${BASE}${path}?${new URLSearchParams(query)}`;

    for (let attempt = 1; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { "X-CMC_PRO_API_KEY": this.key, Accept: "application/json" },
          signal: AbortSignal.timeout(this.timing.timeoutMs),
        });
      } catch (err) {
        if (attempt < ATTEMPTS) {
          await sleep(this.timing.retryMs * attempt);
          continue;
        }
        throw new Error(`${path} failed: ${(err as Error).message}`);
      }

      const body: unknown = await res.json().catch(() => undefined);
      const status: Status | null = isObject(body) && isObject(body.status) ? (body.status as Status) : null;
      const retryable = res.status === 429 || res.status >= 500 || String(status?.error_code) === "500" || (res.ok && !status);

      if (retryable && attempt < ATTEMPTS) {
        await sleep(this.timing.retryMs * attempt);
        continue;
      }

      this.calls.push({
        path,
        params: query,
        credits: Number(status?.credit_count ?? 0),
        errorCode: status?.error_code ?? res.status,
        at: new Date().toISOString(),
      });

      if (!status) throw new Error(`${path} failed: ${res.status} response is not a CMC envelope`);
      if (!res.ok || String(status.error_code) !== "0") {
        throw new Error(`${path} failed: ${res.status} ${status.error_code} ${status.error_message ?? ""}`);
      }
      if (!isObject(body) || body.data === undefined || body.data === null) throw new Error(`${path} failed: response has no data`);
      return body.data as T;
    }
  }
}
