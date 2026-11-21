"use client";
// Live reads, polled every few seconds: the connected user's position and policy from the origin chain, and the
// rescue log assembled from both chains (vault outcomes on the origin chain, rescue requests on Reactive).
import { useQuery } from "@tanstack/react-query";
import { parseAbiItem, type Address, type Hex } from "viem";
import { MockERC20Abi, MockLendingMarketAbi, MockPriceOracleAbi, ProtectionVaultAbi, LiquidationRescueReactiveAbi } from "./abi";
import { dep, deployed, originClient, reactiveClient } from "./config";

const POLL = 2500;
export const OUTCOMES = ["None", "Rescued", "Partially rescued", "Not needed", "No policy", "Paused", "Expired",
  "Budget used up", "No reserve", "Stale price", "Already liquidated", "Repay failed"] as const;

export function useMarket() {
  return useQuery({
    queryKey: ["market"], enabled: deployed, refetchInterval: POLL,
    queryFn: async () => {
      const [[price, updatedAt], lastSeen, users] = await Promise.all([
        originClient.readContract({ address: dep.oracle!, abi: MockPriceOracleAbi, functionName: "latest", args: [dep.weth!] }),
        reactiveClient.readContract({ address: dep.reactiveContract!, abi: LiquidationRescueReactiveAbi, functionName: "lastPrice" }),
        reactiveClient.readContract({ address: dep.reactiveContract!, abi: LiquidationRescueReactiveAbi, functionName: "protectedUsers" }),
      ]);
      return { price, updatedAt: Number(updatedAt), reactiveLastPrice: lastSeen, protectedUsers: users as readonly Address[] };
    },
  });
}

export function useAccountState(user?: Address) {
  return useQuery({
    queryKey: ["account", user], enabled: deployed && Boolean(user), refetchInterval: POLL,
    queryFn: async () => {
      const u = user!;
      const [pos, hf, policy, reserve, weth, usdc, wethAllowance, usdcAllowance] = await Promise.all([
        originClient.readContract({ address: dep.market!, abi: MockLendingMarketAbi, functionName: "positions", args: [u] }),
        originClient.readContract({ address: dep.market!, abi: MockLendingMarketAbi, functionName: "healthFactor", args: [u] }),
        originClient.readContract({ address: dep.vault!, abi: ProtectionVaultAbi, functionName: "getPolicy", args: [u] }),
        originClient.readContract({ address: dep.vault!, abi: ProtectionVaultAbi, functionName: "reserveOf", args: [u] }),
        originClient.readContract({ address: dep.weth!, abi: MockERC20Abi, functionName: "balanceOf", args: [u] }),
        originClient.readContract({ address: dep.usdc!, abi: MockERC20Abi, functionName: "balanceOf", args: [u] }),
        originClient.readContract({ address: dep.weth!, abi: MockERC20Abi, functionName: "allowance", args: [u, dep.market!] }),
        originClient.readContract({ address: dep.usdc!, abi: MockERC20Abi, functionName: "allowance", args: [u, dep.vault!] }),
      ]);
      return { collateral: pos[0], debt: pos[1], hf, policy, reserve, weth, usdc, wethAllowance, usdcAllowance };
    },
  });
}

export type RescueRow = {
  eventId: Hex; user: Address; outcome: string; hfBefore: bigint; hfAfter: bigint; spent: bigint;
  callbackTx: Hex; callbackBlock: bigint; reactiveTx?: Hex; originTx?: Hex; price?: bigint; previousPrice?: bigint;
};
export type PendingRequest = { eventId: Hex; user: Address; reactiveTx: Hex; originTx: Hex; price: bigint };

const evaluated = parseAbiItem("event RescueEvaluated(bytes32 indexed eventId, address indexed user, uint8 outcome, uint256 hfBefore, uint256 hfAfter, uint256 spent)");
const requested = parseAbiItem("event RescueRequested(bytes32 indexed eventId, address indexed user, uint256 price, uint256 previousPrice, uint256 originTxHash)");
const toHash = (v: bigint) => ("0x" + v.toString(16).padStart(64, "0")) as Hex;

/** Every rescue decision, newest first, joined with the Reactive transaction that requested it. */
export function useRescueLog() {
  return useQuery({
    queryKey: ["rescues"], enabled: deployed, refetchInterval: POLL,
    queryFn: async () => {
      const [ev, req] = await Promise.all([
        originClient.getLogs({ address: dep.vault!, event: evaluated, fromBlock: BigInt(dep.originFromBlock) }),
        reactiveClient.getLogs({ address: dep.reactiveContract!, event: requested, fromBlock: BigInt(dep.reactiveFromBlock) }),
      ]);
      const byId = new Map(req.map(r => [r.args.eventId!, r]));
      const rows: RescueRow[] = ev.map(e => {
        const r = byId.get(e.args.eventId!);
        return {
          eventId: e.args.eventId!, user: e.args.user!, outcome: OUTCOMES[e.args.outcome!] ?? "Unknown",
          hfBefore: e.args.hfBefore!, hfAfter: e.args.hfAfter!, spent: e.args.spent!,
          callbackTx: e.transactionHash, callbackBlock: e.blockNumber,
          reactiveTx: r?.transactionHash, originTx: r ? toHash(r.args.originTxHash!) : undefined,
          price: r?.args.price, previousPrice: r?.args.previousPrice,
        };
      }).reverse();
      const done = new Set(ev.map(e => e.args.eventId));
      const pending: PendingRequest[] = req.filter(r => !done.has(r.args.eventId)).map(r => ({
        eventId: r.args.eventId!, user: r.args.user!, reactiveTx: r.transactionHash, originTx: toHash(r.args.originTxHash!), price: r.args.price!,
      })).reverse();
      return { rows, pending };
    },
  });
}

/** Recent collateral prices from the feed's own events, for the chart. */
export function usePriceHistory() {
  return useQuery({
    queryKey: ["prices"], enabled: deployed, refetchInterval: POLL,
    queryFn: async () => {
      const logs = await originClient.getLogs({ address: dep.oracle!, event: parseAbiItem("event PriceUpdated(address indexed asset, uint256 price, uint256 updatedAt)"), args: { asset: dep.weth! }, fromBlock: BigInt(dep.originFromBlock) });
      return logs.slice(-40).map(l => ({ price: l.args.price!, at: Number(l.args.updatedAt!), tx: l.transactionHash }));
    },
  });
}
