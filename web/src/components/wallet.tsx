"use client";
// Connecting a wallet, staying on the vault's chain, and sending transactions with clear progress.
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { BaseError, type Hex } from "viem";
import { Wallet as WalletIcon } from "lucide-react";
import { originClient } from "@/lib/config";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
        if (!mounted) return <span className="inline-block h-10 w-28" />;
        if (!account) return <button className="btn-primary" onClick={openConnectModal}><WalletIcon className="h-4 w-4" />Connect<span className="hidden sm:inline"> wallet</span></button>;
        if (chain?.unsupported) return <button className="btn bg-warn text-bg" onClick={openChainModal}>Wrong network</button>;
        return (
          <button className="btn-ghost font-mono !text-[13px]" onClick={openAccountModal}>
            <span className="h-2 w-2 rounded-full bg-ok shadow-[0_0_8px] shadow-ok" />{account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

export type TxState = { status: "idle" | "busy" | "done" | "error"; label?: string; hash?: Hex; error?: string };

/** Runs wallet transactions in order, waits for each, then refreshes every live read. */
export function useTxRunner() {
  const qc = useQueryClient();
  const [state, setState] = useState<TxState>({ status: "idle" });
  async function run(steps: { label: string; send: () => Promise<Hex> }[]) {
    try {
      let hash: Hex | undefined;
      for (const s of steps) {
        setState({ status: "busy", label: s.label });
        hash = await s.send();
        setState({ status: "busy", label: s.label, hash });
        const r = await originClient.waitForTransactionReceipt({ hash });
        if (r.status !== "success") throw new Error(`${s.label}: the transaction was reverted`);
      }
      setState({ status: "done", hash });
      await qc.invalidateQueries();
      return true;
    } catch (e) {
      const msg = e instanceof BaseError ? e.shortMessage : e instanceof Error ? e.message : String(e);
      setState({ status: "error", error: msg });
      return false;
    }
  }
  return { state, run, busy: state.status === "busy" };
}
