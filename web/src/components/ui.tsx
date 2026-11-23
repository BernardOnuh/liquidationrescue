"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Hex } from "viem";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Loader2, X } from "lucide-react";
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
    ? <a className="mono inline-flex items-center gap-1 hover:text-rescue" href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{text}<ExternalLink className="h-3 w-3" /></a>
    : <span className="mono" title={hash}>{text}</span>;
}

export function TxStatus({ state }: { state: TxState }) {
  if (state.status === "idle") return null;
  if (state.status === "busy") return <p className="mt-3 flex items-center gap-2 text-[13px] text-dim"><Loader2 className="h-4 w-4 animate-spin" />{state.label}{state.hash ? " · confirming" : " · confirm in your wallet"}</p>;
  if (state.status === "done") return <p className="mt-3 flex items-center gap-2 text-[13px] text-ok"><CheckCircle2 className="h-4 w-4" />Confirmed {state.hash && <TxLink side="origin" hash={state.hash} />}</p>;
  return <p className="mt-3 flex items-start gap-2 text-[13px] text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{state.error}</span></p>;
}

/** A dialog over the page: Esc, the backdrop or ✕ close it; focus stays inside while open and returns afterwards. */
export function Modal({ open, onClose, title, eyebrow, tone = "#22e39a", children, footer }: {
  open: boolean; onClose: () => void; title: ReactNode; eyebrow?: ReactNode; tone?: string; children: ReactNode; footer?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(box.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])') ?? []);
    (focusables()[0] ?? box.current)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab") {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; before?.focus?.(); };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <div className="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div ref={box} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}
        className="modal-box relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/12 bg-[#070a11] shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9)] outline-none">
        <div className="h-1 w-full" style={{ background: tone }} />
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div className="min-w-0">
            {eyebrow && <div className="font-mono text-[11px] font-semibold tracking-[0.14em]" style={{ color: tone }}>{eyebrow}</div>}
            <h3 className="mt-1 font-display text-[22px] font-bold tracking-[-0.02em] text-white">{title}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-dim transition hover:border-white/25 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.07] bg-black/30 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }} aria-label="Copy" className="grid h-7 w-7 place-items-center rounded-lg text-dim transition hover:bg-white/[0.06] hover:text-white">
      {done ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
