import { existsSync, readFileSync } from "node:fs";
import type { Receipt } from "../src/lib/build";
import { replay, replayReceipt } from "../src/lib/replay";
import type { Snapshot } from "../src/lib/snapshot";

// Offline and keyless. With no argument, rebuilds data/snapshot.json from data/inputs.json and requires an exact match.
// With a receipt file, rebuilds that one exchange from the raw CMC rows inside it.
const read = (path: string) => readFileSync(path, "utf8");

function fail(problems: string[]) {
  problems.forEach((p) => console.log(p));
  console.log(`FAIL ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  process.exit(1);
}

const arg = process.argv[2];
if (arg) {
  const receipt: Receipt = JSON.parse(read(arg));
  const { problems, linked } = replayReceipt(receipt, existsSync("data/inputs.json") ? read("data/inputs.json") : undefined);
  if (problems.length > 0) fail(problems);
  const rows = receipt.source.assets.length;
  if (linked) {
    console.log(`PASS ${receipt.result.name}: result rebuilt from ${rows} CMC rows (${receipt.methodVersion})`);
    console.log(`     rows and token data match data/inputs.json ${receipt.inputsSha256.slice(0, 12)}`);
  } else {
    console.log(`CONSISTENT ${receipt.result.name}: result follows from the ${rows} rows in this file (${receipt.methodVersion})`);
    console.log(`     not linked: run this inside a clone of the repo so data/inputs.json can confirm the rows came from CMC`);
  }
} else {
  const snapshotText = read("data/snapshot.json");
  const problems = replay(read("data/inputs.json"), snapshotText, read("data/history.json"));
  if (problems.length > 0) fail(problems);
  const s: Snapshot = JSON.parse(snapshotText);
  console.log(
    `PASS snapshot rebuilt exactly from inputs ${s.inputsSha256.slice(0, 12)}: ${s.exchanges.length} exchanges, ${s.noWallets.length} without wallets, ${s.calls.length} calls (${s.methodVersion})`,
  );
}
