const BASE = "https://pro-api.coinmarketcap.com";
const SPACING_MS = 1300;

export type CallLog = {
  path: string;
  params: Record<string, string>;
  credits: number;
  errorCode: number | string;
  at: string;
};

export class Cmc {
  calls: CallLog[] = [];
  private last = 0;

  constructor(private key: string) {
    if (!key) throw new Error("CMC_PRO_API_KEY is not set");
  }

  get credits() {
    return this.calls.reduce((n, c) => n + c.credits, 0);
  }

  async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const wait = this.last + SPACING_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.last = Date.now();

    const query = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]));
    const url = `${BASE}${path}?${new URLSearchParams(query)}`;

    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, { headers: { "X-CMC_PRO_API_KEY": this.key, Accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      const status = body.status ?? {};
      const retryable = res.status === 429 || res.status >= 500 || String(status.error_code) === "500";

      if (retryable && attempt < 4) {
        await new Promise((r) => setTimeout(r, 5000 * attempt));
        continue;
      }

      this.calls.push({
        path,
        params: query,
        credits: Number(status.credit_count ?? 0),
        errorCode: status.error_code ?? res.status,
        at: new Date().toISOString(),
      });

      if (!res.ok || (status.error_code && String(status.error_code) !== "0")) {
        throw new Error(`${path} failed: ${res.status} ${status.error_code} ${status.error_message ?? ""}`);
      }
      return body.data as T;
    }
  }
}
