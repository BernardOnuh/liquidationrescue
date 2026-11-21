// Which deployment the dashboard talks to: NEXT_PUBLIC_NETWORK=local (default) or testnet. Addresses come from
// src/deployments/*.json, written by the contracts' deploy scripts.
import { createPublicClient, defineChain, http, type Address, type Chain, type Hex } from "viem";
import local from "../deployments/local.json";
import testnet from "../deployments/testnet.json";

type ChainInfo = { chainId: number; rpc: string; name: string; explorer: string };
export type Deployment = {
  network: string; simulated: boolean; origin: ChainInfo; reactive: ChainInfo;
  weth: Address | null; usdc: Address | null; oracle: Address | null; market: Address | null; adapter: Address | null;
  reactiveContract: Address | null; vault: Address | null; callbackProxy: Address | null;
  originFromBlock: number; reactiveFromBlock: number; priceOperator: Address | null; devAccounts: Address[];
};

export const network = process.env.NEXT_PUBLIC_NETWORK === "testnet" ? "testnet" : "local";
export const dep = (network === "testnet" ? testnet : local) as Deployment;
export const deployed = Boolean(dep.vault && dep.reactiveContract && dep.market && dep.oracle);
export const isLocal = network === "local";

const toChain = (c: ChainInfo): Chain => defineChain({
  id: c.chainId, name: c.name, nativeCurrency: { name: c.chainId === 5318007 ? "REACT" : "Ether", symbol: c.chainId === 5318007 ? "REACT" : "ETH", decimals: 18 },
  rpcUrls: { default: { http: [c.rpc] } },
  ...(c.explorer ? { blockExplorers: { default: { name: "Explorer", url: c.explorer } } } : {}),
});
export const originChain = toChain(dep.origin);
export const reactiveChain = toChain(dep.reactive);
export const originClient = createPublicClient({ chain: originChain, transport: http(dep.origin.rpc) });
export const reactiveClient = createPublicClient({ chain: reactiveChain, transport: http(dep.reactive.rpc) });

/** Explorer link for a transaction, or null on the local chain (no explorer). */
export const txUrl = (side: "origin" | "reactive", hash: Hex) => {
  const e = dep[side].explorer;
  return e ? `${e}/tx/${hash}` : null;
};
