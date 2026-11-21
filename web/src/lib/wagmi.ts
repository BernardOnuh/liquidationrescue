// Wallet connections through RainbowKit, on the chain where the vault lives (Base Sepolia, or the local chain).
// On the local chain, "local test accounts" sign with the Hardhat node's unlocked accounts.
import { connectorsForWallets, type Wallet, type WalletList } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, rabbyWallet, coinbaseWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, createConnector, http } from "wagmi";
import { mock } from "wagmi/connectors";
import type { Address } from "viem";
import { dep, isLocal, originChain } from "./config";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
const DEV_NAMES = ["Borrower (Alice)", "Borrower (Bob)", "Price feed operator"];
const DEV_ICON = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="7" fill="#FF7A45"/><path d="M9 10l-3 4 3 4M19 10l3 4-3 4M16 8l-4 12" stroke="#0B0F1A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');

/** A local test account as a RainbowKit wallet that reconnects after a reload. */
const devWallet = (account: Address, i: number) => (): Wallet => ({
  id: `dev-${i}`, name: DEV_NAMES[i] ?? `Test account ${i + 1}`, iconUrl: DEV_ICON, iconBackground: "#FF7A45",
  createConnector: details => {
    const base = mock({ accounts: [account], features: { reconnect: true } });
    const key = "lr.devWallet";
    return createConnector(config => {
      const c = base(config);
      return {
        ...c, ...details.rkDetails, id: `dev-${i}`, name: DEV_NAMES[i],
        async connect(params) { const r = await c.connect(params); try { localStorage.setItem(key, `dev-${i}`); } catch {} return r; },
        async disconnect() { try { localStorage.removeItem(key); } catch {} return c.disconnect(); },
        async isAuthorized() { try { return localStorage.getItem(key) === `dev-${i}`; } catch { return false; } },
      } as typeof c;
    });
  },
});

const wallets: WalletList = [
  { groupName: "Browser wallets", wallets: projectId ? [injectedWallet, metaMaskWallet, rabbyWallet, coinbaseWallet] : [injectedWallet, rabbyWallet] },
  ...(projectId ? [{ groupName: "Phone wallets", wallets: [walletConnectWallet] }] : []),
  ...(isLocal && dep.devAccounts.length ? [{ groupName: "Local test accounts", wallets: dep.devAccounts.map((a, i) => devWallet(a, i)) }] : []),
];

export const wagmiConfig = createConfig({
  chains: [originChain],
  connectors: connectorsForWallets(wallets, { appName: "LiquidationRescue", projectId: projectId || "liquidationrescue-no-walletconnect" }),
  transports: { [originChain.id]: http(dep.origin.rpc) },
  ssr: true,
});
