import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Landing } from "@/components/landing/Landing";
import type { LatencySummary } from "@/components/landing/Speed";

// Measured testnet latency, written by `NETWORK=testnet npm run latency` (contracts/scripts/latency.ts). Shown only when
// it exists and isn't from the simulated local chain.
function readLatency(): LatencySummary | null {
  const dir = join(process.cwd(), "src", "deployments");
  const file = join(dir, "latency-testnet.json");
  if (!existsSync(file)) return null;
  const { summary, rescues } = JSON.parse(readFileSync(file, "utf8"));
  if (summary.simulated || !summary.completed) return null;
  const done = rescues.filter((r: any) => r.loop);
  const blocks = done.map((r: any) => r.loop.blocks).sort((a: number, b: number) => a - b);
  const ex = done[0];
  const dep = existsSync(join(dir, "testnet.json")) ? JSON.parse(readFileSync(join(dir, "testnet.json"), "utf8")) : {};
  return {
    completed: summary.completed, loopSeconds: summary.loopSeconds, loopEstimatedMs: summary.loopEstimatedMs,
    originBlockTimeMs: summary.originBlockTimeMs, medianBlocks: blocks.length ? blocks[Math.floor(blocks.length / 2)] : null,
    example: ex ? { origin: ex.origin.tx, reactive: ex.reactive.tx, callback: ex.callback.tx } : null,
    explorers: { origin: dep.origin?.explorer || "https://sepolia.basescan.org", reactive: dep.reactive?.explorer || "https://lasna.reactscan.net" },
    measuredAt: summary.measuredAt,
  };
}

export default function Home() {
  return <Landing latency={readLatency()} />;
}
