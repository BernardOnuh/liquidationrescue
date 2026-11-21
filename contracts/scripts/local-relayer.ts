// LOCAL SIMULATION of Reactive Network, for the demo chain only. It reads the subscriptions recorded at the system
// contract stand-in, feeds every matching log to the subscriber's react() as the system contract would, and delivers
// each CallbackRequest through the callback proxy stand-in. On testnet the real network does this instead.
import hre from "hardhat";
import { readFileSync } from "node:fs";
import { decodeEventLog, getAddress, type Hex, type Log } from "viem";

const SYSTEM = "0x8888888888888888888888888888888888888888" as const;
const IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313adn;
const d = JSON.parse(readFileSync("../web/src/deployments/local.json", "utf8"));

async function main() {
  const pub = await hre.viem.getPublicClient();
  const chainId = BigInt(await pub.getChainId());
  await hre.network.provider.send("hardhat_impersonateAccount", [SYSTEM]);
  await hre.network.provider.send("hardhat_setBalance", [SYSTEM, "0x56BC75E2D63100000"]);
  const asSystem = await hre.viem.getWalletClient(SYSTEM);
  const system = await hre.viem.getContractAt("MockSystemContract", SYSTEM);
  const proxy = await hre.viem.getContractAt("MockCallbackProxy", d.callbackProxy);
  const reactiveAbi = (await hre.artifacts.readArtifact("LiquidationRescueReactive")).abi;
  let from = BigInt(d.originFromBlock);
  console.log("[relayer] local simulation of Reactive Network, from block", from);

  for (;;) {
    const latest = await pub.getBlockNumber();
    if (latest >= from) {
      const logs = await pub.getLogs({ fromBlock: from, toBlock: latest });
      from = latest + 1n;
      const n = await system.read.subscriptionCount();
      const subs = await Promise.all(Array.from({ length: Number(n) }, (_, i) => system.read.subscriptions([BigInt(i)])));
      for (const log of logs) await handle(log, subs);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  async function handle(log: Log, subs: readonly (readonly [bigint, Hex, bigint, bigint, bigint, bigint, Hex])[]) {
    if (getAddress(log.address) === getAddress(SYSTEM)) {
      const ev = decodeEventLog({ abi: system.abi, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      if (ev.eventName !== "CallbackRequest" || ev.args.chainId !== chainId) return;
      try {
        const hash = await proxy.write.deliver([ev.args.sender, ev.args.recipient, ev.args.payload]);
        console.log(`[relayer] callback delivered to ${ev.args.recipient}: ${hash}`);
      } catch (e) {
        console.log(`[relayer] callback to ${ev.args.recipient} failed: ${(e as Error).message.split("\n")[0]}`);
      }
      return;
    }
    const topics = [0, 1, 2, 3].map(i => (log.topics[i] ? BigInt(log.topics[i]!) : 0n));
    const delivered = new Set<string>();
    for (const [c, addr, t0, t1, t2, t3, subscriber] of subs) {
      const match = (c === 0n || c === chainId)
        && (BigInt(addr) === 0n || getAddress(addr) === getAddress(log.address))
        && [t0, t1, t2, t3].every((t, i) => t === IGNORE || t === topics[i]);
      if (!match || delivered.has(subscriber)) continue;
      delivered.add(subscriber);
      const hash = await asSystem.writeContract({
        address: subscriber, abi: reactiveAbi, functionName: "react", account: SYSTEM, chain: null,
        args: [{ chainId, contractAddress: log.address, topic0: topics[0], topic1: topics[1], topic2: topics[2], topic3: topics[3],
          data: log.data, blockNumber: log.blockNumber!, opCode: BigInt(log.topics.length), blockHash: BigInt(log.blockHash!),
          txHash: BigInt(log.transactionHash!), logIndex: BigInt(log.logIndex!) }],
      });
      console.log(`[relayer] react() for log ${log.transactionHash}#${log.logIndex}: ${hash}`);
    }
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
