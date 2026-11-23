// Gets Lasna REACT for the deploy wallet: sends Ethereum Sepolia ETH from it to Reactive's faucet contract, which
// credits 100 REACT per 1 SepETH on Lasna to the sender. Testnet only.
// usage: REACT_FAUCET_ETH=0.05 npx hardhat run scripts/faucet.ts   (default 0.05, at most 5)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const FAUCET = "0x9b9BB25f1A81078C544C829c5EB7822d747Cf434";

async function main() {
  const amount = process.env.REACT_FAUCET_ETH || "0.05";
  if (!(Number(amount) > 0 && Number(amount) <= 5)) throw new Error("REACT_FAUCET_ETH must be between 0 and 5");
  const key = readFileSync(join(__dirname, "..", ".env"), "utf8").match(/^REACTIVE_PRIVATE_KEY=(0x[0-9a-fA-F]{64})$/m)?.[1];
  if (!key) throw new Error("no REACTIVE_PRIVATE_KEY in contracts/.env; run npm run wallet first");
  const account = privateKeyToAccount(key as `0x${string}`);
  const transport = http(process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com");
  const wallet = createWalletClient({ account, chain: sepolia, transport });
  const hash = await wallet.sendTransaction({ to: FAUCET, value: parseEther(amount) });
  console.log(`Sent ${amount} SepETH from ${account.address} to Reactive's faucet: https://sepolia.etherscan.io/tx/${hash}`);
  const receipt = await createPublicClient({ chain: sepolia, transport }).waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber} (${receipt.status}). REACT arrives on Lasna shortly; check with npm run wallet.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
