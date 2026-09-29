import { existsSync, readFileSync } from "node:fs";

export function loadKey() {
  if (process.env.CMC_PRO_API_KEY) return process.env.CMC_PRO_API_KEY;
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.startsWith("CMC_PRO_API_KEY="));
  return line ? line.slice("CMC_PRO_API_KEY=".length).trim() : "";
}
