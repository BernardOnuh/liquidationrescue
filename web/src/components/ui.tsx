"use client";
import type { ReactNode } from "react";
import type { Hex } from "viem";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { txUrl } from "@/lib/config";
import { short } from "@/lib/format";
import type { TxState } from "./wallet";

export function Panel({ title, icon, right, children, className = "" }: { title: string; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-bold tracking-[-0.01em]">{icon}{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "warn" | "danger" | "dim" }) {
  const c = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : "text-text";
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 truncate font-mono text-[20px] font-semibold tabular-nums ${c}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[12px] text-dim">{sub}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  ok: "bg-ok/10 text-ok border-ok/25", warn: "bg-warn/10 text-warn border-warn/25", danger: "bg-danger/10 text-danger border-danger/25",
  rescue: "bg-rescue-soft text-rescue border-rescue/30", reactive: "bg-reactive/10 text-reactive border-reactive/25", dim: "bg-white/5 text-dim border-edge",
};
export function Badge({ tone = "dim", children }: { tone?: keyof typeof TONES | string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${TONES[tone] ?? TONES.dim}`}>{children}</span>;
}

export function TxLink({ side, hash, label }: { side: "origin" | "reactive"; hash?: Hex; label?: string }) {
  if (!hash) return <span className="mono text-dim">–</span>;
  const url = txUrl(side, hash);
  const text = <>{label && <span className="text-dim">{label} </span>}{short(hash, 8)}</>;
  return url
    ? <a className="mono inline-flex items-center gap-1 hover:text-rescue" href={url} target="_blank" rel="noreferrer">{text}<ExternalLink className="h-3 w-3" /></a>
    : <span className="mono" title={hash}>{text}</span>;
}

export function TxStatus({ state }: { state: TxState }) {
  if (state.status === "idle") return null;
  if (state.status === "busy") return <p className="mt-3 flex items-center gap-2 text-[13px] text-dim"><Loader2 className="h-4 w-4 animate-spin" />{state.label}{state.hash ? " · confirming" : " · confirm in your wallet"}</p>;
  if (state.status === "done") return <p className="mt-3 flex items-center gap-2 text-[13px] text-ok"><CheckCircle2 className="h-4 w-4" />Confirmed {state.hash && <TxLink side="origin" hash={state.hash} />}</p>;
  return <p className="mt-3 flex items-start gap-2 text-[13px] text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{state.error}</span></p>;
}
