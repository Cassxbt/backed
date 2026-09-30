import { readFileSync } from "node:fs";
import { replaySnapshot } from "../src/lib/replay";
import type { Snapshot } from "../src/lib/snapshot";

// Offline and keyless: recomputes every exchange from data/snapshot.json and fails on any mismatch.
const snapshot: Snapshot = JSON.parse(readFileSync(process.argv[2] ?? "data/snapshot.json", "utf8"));
const problems = replaySnapshot(snapshot);

if (problems.length > 0) {
  problems.forEach((p) => console.log(p));
  console.log(`FAIL ${problems.length} mismatches`);
  process.exit(1);
}
console.log(`PASS ${snapshot.exchanges.length} exchanges replayed from ${snapshot.generatedAt} (${snapshot.methodVersion})`);
