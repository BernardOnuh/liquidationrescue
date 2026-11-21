// Staged testnet deployment. Reactive's deployment order: the reactive contract first, then the callback contract
// with its address, then link. Each step records addresses in deployments.json.
//   1. npx hardhat run scripts/deploy.ts --network baseSepolia   (STEP=origin)   token, oracle, market, adapter
//   2. npx hardhat run scripts/deploy.ts --network lasna         (STEP=reactive) LiquidationRescueReactive
//   3. npx hardhat run scripts/deploy.ts --network baseSepolia   (STEP=vault)    ProtectionVault
//   4. npx hardhat run scripts/deploy.ts --network lasna         (STEP=link)     setVault
// Keys come from DESTINATION_PRIVATE_KEY / REACTIVE_PRIVATE_KEY. Use dedicated testnet wallets only.
import hre from "hardhat";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEther, type Hex } from "viem";

const FILE = "deployments.json";
const BASE_SEPOLIA_CALLBACK_PROXY = "0x476F44b11F5C942c58f4c8E3d0300E5710743585"; // Reactive docs, origins & destinations
const MAX_PRICE_AGE = 3600n;

const d: Record<string, Hex | string> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
const save = () => writeFileSync(FILE, JSON.stringify(d, null, 2) + "\n");
const need = (k: string) => { if (!d[k]) throw new Error(`${k} missing from ${FILE}: run the earlier step first`); return d[k] as Hex; };

async function main() {
  const step = process.env.STEP;
  const [me] = await hre.viem.getWalletClients();
  console.log(`step ${step} on ${hre.network.name} from ${me.account.address}`);
  if (step === "origin") {
    const weth = await hre.viem.deployContract("MockERC20", ["Test WETH", "tWETH", 18]);
    const usdc = await hre.viem.deployContract("MockERC20", ["Test USDC", "tUSDC", 6]);
    const oracle = await hre.viem.deployContract("MockPriceOracle", [me.account.address]);
    await oracle.write.setPrice([weth.address, 2000n * 10n ** 8n]);
    const market = await hre.viem.deployContract("MockLendingMarket", [weth.address, usdc.address, oracle.address]);
    await usdc.write.mint([market.address, 1_000_000n * 10n ** 6n]);
    const adapter = await hre.viem.deployContract("MockMarketAdapter", [market.address]);
    Object.assign(d, { originChainId: String(hre.network.config.chainId), weth: weth.address, usdc: usdc.address, oracle: oracle.address, market: market.address, adapter: adapter.address });
  } else if (step === "reactive") {
    const reactive = await hre.viem.deployContract("LiquidationRescueReactive",
      [me.account.address, BigInt(need("originChainId")), need("oracle"), need("weth")],
      { value: parseEther(process.env.REACTIVE_FUNDING ?? "1") }); // REACT, pays for reactive transactions
    d.reactive = reactive.address;
  } else if (step === "vault") {
    const vault = await hre.viem.deployContract("ProtectionVault",
      [BASE_SEPOLIA_CALLBACK_PROXY, need("reactive"), need("adapter"), MAX_PRICE_AGE],
      { value: parseEther(process.env.VAULT_FUNDING ?? "0.01") }); // ETH, pays for callbacks
    d.vault = vault.address;
  } else if (step === "link") {
    const reactive = await hre.viem.getContractAt("LiquidationRescueReactive", need("reactive"));
    await reactive.write.setVault([need("vault")]);
    d.linked = "true";
  } else {
    throw new Error("set STEP to origin, reactive, vault or link");
  }
  save();
  console.log(d);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
