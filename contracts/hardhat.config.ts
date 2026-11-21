import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";

// Keys come from the environment and are never committed. Use dedicated testnet wallets only.
const destKey = process.env.DESTINATION_PRIVATE_KEY ? [process.env.DESTINATION_PRIVATE_KEY] : [];
const reactiveKey = process.env.REACTIVE_PRIVATE_KEY ? [process.env.REACTIVE_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  // reactive-lib-omni requires ^0.8.29.
  solidity: { version: "0.8.29", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    // Local demo chain (scripts/dev-local.ts + scripts/local-relayer.ts). Separate port from other local nodes.
    local: { url: "http://127.0.0.1:8546", chainId: 31337 },
    // From Reactive Network's docs (origins & destinations): chain IDs and RPCs.
    baseSepolia: { url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org", chainId: 84532, accounts: destKey },
    lasna: { url: process.env.REACTIVE_RPC || "https://lasna-rpc.rnk.dev/", chainId: 5318007, accounts: reactiveKey },
  },
};

export default config;
