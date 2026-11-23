// Measures the full rescue loop for every rescue on record: price event on the origin chain → Reactive's react() and
// callback request → ProtectionVault.onRiskEvent on the destination chain. Origin and callback are both on Base Sepolia,
// so the loop is timed on one chain's clock (block timestamps, and block count × block time for sub-second detail).
// The middle hop is on Lasna, so the split between the two hops is approximate (two chains' clocks).
// usage: NETWORK=testnet npx hardhat run scripts/latency.ts      (NETWORK=local for the simulated local chain)
// Writes web/src/deployments/latency-<network>.json for the dashboard and prints a table.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, http, parseAbiItem, type Hex } from "viem";

const NETWORK = process.env.NETWORK || "testnet";
const DIR = join(__dirname, "..", "..", "web", "src", "deployments");
const d = JSON.parse(readFileSync(join(DIR, `${NETWORK}.json`), "utf8"));

const RESCUE_REQUESTED = parseAbiItem("event RescueRequested(bytes32 indexed eventId, address indexed user, uint256 price, uint256 previousPrice, uint256 originTxHash)");
const RESCUE_EVALUATED = parseAbiItem("event RescueEvaluated(bytes32 indexed eventId, address indexed user, uint8 outcome, uint256 hfBefore, uint256 hfAfter, uint256 spent)");
const OUTCOMES = ["None", "Rescued", "PartiallyRescued", "NotNeeded", "PolicyInactive", "PolicyPaused", "PolicyExpired", "BudgetExhausted", "NoReserve", "StalePrice", "AlreadyLiquidated", "RepayFailed"];
const CHUNK = BigInt(process.env.LOG_CHUNK || 5000); // public RPCs cap getLogs ranges

const origin = createPublicClient({ transport: http(d.origin.rpc) });
const reactive = createPublicClient({ transport: http(d.reactive.rpc) });

async function logs(client: typeof origin, address: Hex, event: any, from: bigint) {
  const latest = await client.getBlockNumber();
  const out: any[] = [];
  for (let a = from; a <= latest; a += CHUNK) {
    const b = a + CHUNK - 1n > latest ? latest : a + CHUNK - 1n;
    out.push(...await client.getLogs({ address, event, fromBlock: a, toBlock: b }));
  }
  return out;
}

const blockCache = new Map<string, Promise<{ number: bigint; timestamp: bigint }>>();
const block = (client: typeof origin, tag: string, n: bigint) => {
  const k = `${tag}:${n}`;
  if (!blockCache.has(k)) blockCache.set(k, client.getBlock({ blockNumber: n }).then(b => ({ number: b.number, timestamp: b.timestamp })));
  return blockCache.get(k)!;
};

// Average block time over the last 500 blocks, in ms: the resolution of the block-count measure.
async function blockTimeMs(client: typeof origin) {
  const latest = await client.getBlockNumber();
  const span = latest > 500n ? 500n : latest;
  if (span === 0n) return 0;
  const [a, b] = await Promise.all([client.getBlock({ blockNumber: latest - span }), client.getBlock({ blockNumber: latest })]);
  return Number(b.timestamp - a.timestamp) * 1000 / Number(span);
}

const pct = (xs: number[], p: number) => { if (!xs.length) return null; const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

async function main() {
  const [requested, evaluated, originMs] = await Promise.all([
    logs(reactive, d.reactiveContract, RESCUE_REQUESTED, BigInt(d.reactiveFromBlock || 0)),
    logs(origin, d.vault, RESCUE_EVALUATED, BigInt(d.originFromBlock || 0)),
    blockTimeMs(origin),
  ]);
  const callbacks = new Map(evaluated.map(l => [l.args.eventId as string, l]));

  const rows = [];
  for (const r of requested) {
    const cb = callbacks.get(r.args.eventId);
    const originTx = ("0x" + (r.args.originTxHash as bigint).toString(16).padStart(64, "0")) as Hex;
    const originRcpt = await origin.getTransactionReceipt({ hash: originTx }).catch(() => null);
    if (!originRcpt) continue; // the origin event is not on this chain (e.g. an older deployment)
    const [ob, rb, cbb] = await Promise.all([
      block(origin, "o", originRcpt.blockNumber),
      block(reactive, "r", r.blockNumber),
      cb ? block(origin, "o", cb.blockNumber) : null,
    ]);
    const row: any = {
      eventId: r.args.eventId, user: r.args.user,
      origin: { tx: originTx, block: Number(ob.number), timestamp: Number(ob.timestamp) },
      reactive: { tx: r.transactionHash, block: Number(rb.number), timestamp: Number(rb.timestamp) },
      callback: cb ? { tx: cb.transactionHash, block: Number(cbb!.number), timestamp: Number(cbb!.timestamp), outcome: OUTCOMES[Number(cb.args.outcome)] } : null,
    };
    if (cb) {
      const blocks = Number(cbb!.number - ob.number);
      row.loop = {
        seconds: Number(cbb!.timestamp - ob.timestamp),        // same chain, same clock
        blocks,                                              // origin blocks between the price event and the rescue
        // Block count × measured block time. Only on chains with a steady block time: a local chain mines on demand.
        estimatedMs: d.simulated ? null : Math.round(blocks * originMs),
        originToReactiveS: Number(rb.timestamp - ob.timestamp),   // across two chains' clocks: approximate
        reactiveToCallbackS: Number(cbb!.timestamp - rb.timestamp),
      };
    }
    rows.push(row);
  }

  const done = rows.filter(r => r.loop);
  const secs = done.map(r => r.loop.seconds), ms = done.map(r => r.loop.estimatedMs).filter((x: number | null) => x !== null);
  const summary = {
    network: NETWORK, simulated: !!d.simulated, measuredAt: new Date().toISOString(),
    originChain: d.origin.name, reactiveChain: d.reactive.name, originBlockTimeMs: d.simulated ? null : Math.round(originMs),
    requested: rows.length, completed: done.length,
    loopSeconds: { median: pct(secs, .5), p90: pct(secs, .9), min: secs.length ? Math.min(...secs) : null, max: secs.length ? Math.max(...secs) : null },
    loopEstimatedMs: { median: pct(ms, .5), p90: pct(ms, .9) },
  };
  writeFileSync(join(DIR, `latency-${NETWORK}.json`), JSON.stringify({ summary, rescues: rows }, null, 2) + "\n");

  console.log(`${summary.originChain} → ${summary.reactiveChain} → ${summary.originChain}${summary.simulated ? "  (SIMULATED: local relayer, not Reactive Network)" : ""}`);
  console.log(`${summary.originBlockTimeMs === null ? "local chain mines on demand, so no block-time estimate" : `origin block time ≈ ${summary.originBlockTimeMs} ms`} · ${done.length}/${rows.length} rescues completed\n`);
  console.log("event      outcome            origin blk → callback blk   loop      ≈ms     origin→reactive  reactive→callback");
  for (const r of rows) {
    const l = r.loop;
    console.log(`${r.eventId.slice(0, 10)} ${(r.callback?.outcome || "pending").padEnd(18)} ${String(r.origin.block).padStart(10)} → ${String(r.callback?.block ?? "-").padEnd(12)} ${l ? (l.seconds + " s").padStart(6) : "     -"}  ${l && l.estimatedMs !== null ? String(l.estimatedMs).padStart(7) : "      -"}   ${l ? (l.originToReactiveS + " s").padStart(8) : ""}        ${l ? (l.reactiveToCallbackS + " s").padStart(8) : ""}`);
  }
  if (done.length) console.log(`\nfull loop: median ${summary.loopSeconds.median} s${summary.loopEstimatedMs.median !== null ? ` (≈${summary.loopEstimatedMs.median} ms by block count)` : ""}, p90 ${summary.loopSeconds.p90} s`);
  console.log(`wrote web/src/deployments/latency-${NETWORK}.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
