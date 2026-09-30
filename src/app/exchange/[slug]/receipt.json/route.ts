import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeReceipt } from "@/lib/build";
import { snapshot } from "@/lib/data";
import { type Inputs, sha256 } from "@/lib/inputs";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return snapshot.exchanges.map((e) => ({ slug: e.slug }));
}

export async function GET(_req: Request, ctx: RouteContext<"/exchange/[slug]/receipt.json">) {
  const text = readFileSync(join(process.cwd(), "data/inputs.json"), "utf8");
  // Refuse to publish receipts from inputs the snapshot was not built from.
  if (sha256(text) !== snapshot.inputsSha256) throw new Error("data/inputs.json does not match the snapshot's inputs hash");

  const receipt = makeReceipt(JSON.parse(text) as Inputs, snapshot.inputsSha256, (await ctx.params).slug);
  if (!receipt) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(receipt, null, 1), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="backed-${receipt.source.slug}-receipt.json"` },
  });
}
