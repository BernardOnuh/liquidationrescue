// Local demo chain: deploys everything to a Hardhat node on :8546, with Reactive Network's system contract and
// callback proxy played by test stand-ins. Run scripts/local-relayer.ts next to it to deliver events and callbacks.
//   npx hardhat node --port 8546
//   npx hardhat run scripts/dev-local.ts --network local
//   npx hardhat run scripts/local-relayer.ts --network local
import hre from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseEther, parseUnits } from "viem";

const SYSTEM = "0x8888888888888888888888888888888888888888";

async function main() {
  const pub = await hre.viem.getPublicClient();
  const [deployer, alice, bob] = await hre.viem.getWalletClients();
  const startBlock = await pub.getBlockNumber();
  const chainId = await pub.getChainId();

  const sysImpl = await hre.viem.deployContract("MockSystemContract");
  await hre.network.provider.send("hardhat_setCode", [SYSTEM, await pub.getCode({ address: sysImpl.address })]);

  const weth = await hre.viem.deployContract("MockERC20", ["Test WETH", "tWETH", 18]);
  const usdc = await hre.viem.deployContract("MockERC20", ["Test USDC", "tUSDC", 6]);
  const oracle = await hre.viem.deployContract("MockPriceOracle", [deployer.account.address]);
  await oracle.write.setPrice([weth.address, 2000n * 10n ** 8n]);
  const market = await hre.viem.deployContract("MockLendingMarket", [weth.address, usdc.address, oracle.address]);
  await usdc.write.mint([market.address, parseUnits("1000000", 6)]);
  const adapter = await hre.viem.deployContract("MockMarketAdapter", [market.address]);
  const reactive = await hre.viem.deployContract("LiquidationRescueReactive", [deployer.account.address, BigInt(chainId), oracle.address, weth.address]);
  const proxy = await hre.viem.deployContract("MockCallbackProxy");
  const vault = await hre.viem.deployContract("ProtectionVault", [proxy.address, reactive.address, adapter.address, 3600n], { value: parseEther("1") });
  await reactive.write.setVault([vault.address]);
  // Re-publish the price now the reactive contract is subscribed, so it has a baseline to compare drops against.
  await oracle.write.setPrice([weth.address, 2000n * 10n ** 8n]);

  const d = {
    network: "local", simulated: true,
    origin: { chainId, rpc: "http://127.0.0.1:8546", name: "Local chain", explorer: "" },
    reactive: { chainId, rpc: "http://127.0.0.1:8546", name: "Local chain (Reactive simulated)", explorer: "" },
    weth: weth.address, usdc: usdc.address, oracle: oracle.address, market: market.address, adapter: adapter.address,
    reactiveContract: reactive.address, vault: vault.address, callbackProxy: proxy.address,
    originFromBlock: Number(startBlock), reactiveFromBlock: Number(startBlock),
    priceOperator: deployer.account.address,
    devAccounts: [alice.account.address, bob.account.address, deployer.account.address],
  };
  mkdirSync("../web/src/deployments", { recursive: true });
  writeFileSync("../web/src/deployments/local.json", JSON.stringify(d, null, 2) + "\n");
  console.log(d);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
