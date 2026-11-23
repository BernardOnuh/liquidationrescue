// Makes a throwaway testnet wallet for the deploy, saves its key to contracts/.env (git-ignored) and prints only the
// address and what to fund it with. Run again to see the address and its balances. Never use it for real funds.
// usage: npx hardhat run scripts/wallet.ts
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, formatEther, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { baseSepolia, sepolia } from "viem/chains";

const ENV = join(__dirname, "..", ".env");
const has = (name: string) => existsSync(ENV) && new RegExp(`^${name}=0x[0-9a-fA-F]{64}$`, "m").test(readFileSync(ENV, "utf8"));

if (!has("DESTINATION_PRIVATE_KEY")) {
  const key = generatePrivateKey();
  // One account for both chains keeps funding simple; the two names stay separate so they can differ later.
  appendFileSync(ENV, `DESTINATION_PRIVATE_KEY=${key}\nREACTIVE_PRIVATE_KEY=${key}\n`, { mode: 0o600 });
  console.log("New testnet wallet saved to contracts/.env (git-ignored).");
}
const key = readFileSync(ENV, "utf8").match(/^DESTINATION_PRIVATE_KEY=(0x[0-9a-fA-F]{64})$/m)![1] as `0x${string}`;
const { address } = privateKeyToAccount(key);

const lasna = { id: 5318007, name: "Lasna", nativeCurrency: { name: "REACT", symbol: "REACT", decimals: 18 }, rpcUrls: { default: { http: [process.env.REACTIVE_RPC || "https://lasna-rpc.rnk.dev/"] } } } as const;
const balance = async (chain: any, url?: string) => {
  try { return formatEther(await createPublicClient({ chain, transport: http(url) }).getBalance({ address })); }
  catch { return "unreachable"; }
};

async function main() {
  console.log(`\nAddress: ${address}`);
  console.log(`Base Sepolia ETH:     ${await balance(baseSepolia, process.env.BASE_SEPOLIA_RPC)}`);
  console.log(`Ethereum Sepolia ETH: ${await balance(sepolia, process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com")}`);
  console.log(`Lasna REACT:          ${await balance(lasna)}`);
  console.log(`
Fund it (testnet only, all free):
  1. Base Sepolia ETH, about 0.05: any Base Sepolia faucet, to the address above (pays for the vault and origin).
  2. Ethereum Sepolia ETH, about 0.1: any Sepolia faucet, to the same address.
  3. Lasna REACT: from this address on Ethereum Sepolia, send that Sepolia ETH to Reactive's faucet
     0x9b9BB25f1A81078C544C829c5EB7822d747Cf434 (100 REACT per 1 SepETH; 0.05 SepETH gives 5 REACT).
Then run the four deploy steps in the README.`);
}

main();
