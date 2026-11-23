"use client";
// A market crash you can trigger. The price falls in steps (each step = one price event); every event below the trigger
// runs the vault's decision from rescue-sim.ts, which mirrors ProtectionVault. Liquidation happens when HF < 1.
// Everything runs in the browser: no transaction is sent.
import { useEffect, useRef, useState } from "react";
import { RotateCcw, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { evaluate, healthFactor, priceAtHF, type Outcome, type SimPosition } from "@/lib/rescue-sim";
import { Eyebrow } from "./Landing";

const START = { price: 3200, collateral: 2, debt: 3200 };
const PRESETS = {
  funded: { label: "Funded reserve", reserve: 1000, maxSpend: 1500 },
  low: { label: "Low reserve", reserve: 150, maxSpend: 1500 },
  none: { label: "No reserve", reserve: 0, maxSpend: 1500 },
} as const;
type PresetKey = keyof typeof PRESETS;
const TRIGGER = 1.2, TARGET = 1.5, FLOOR = 1700, STEP = 0.035; // each event drops the price 3.5%

interface Ev { price: number; outcome: Outcome | "Liquidated"; amount: number; hfBefore: number; hfAfter: number }

export function Simulator() {
  const [preset, setPreset] = useState<PresetKey>("funded");
  const [price, setPrice] = useState(START.price);
  const [pos, setPos] = useState<SimPosition>({ collateral: START.collateral, debt: START.debt });
  const [spent, setSpent] = useState(0);
  const [reserve, setReserve] = useState<number>(PRESETS.funded.reserve);
  const [events, setEvents] = useState<Ev[]>([]);
  const [running, setRunning] = useState(false);
  const [liquidated, setLiquidated] = useState(false);
  const [flash, setFlash] = useState<"threat" | "rescue" | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const state = useRef({ price, pos, spent, reserve, liquidated });
  state.current = { price, pos, spent, reserve, liquidated };

  const reset = (k: PresetKey = preset) => {
    if (timer.current) clearInterval(timer.current);
    setRunning(false); setPrice(START.price); setPos({ collateral: START.collateral, debt: START.debt }); setSpent(0);
    setReserve(PRESETS[k].reserve); setEvents([]); setLiquidated(false); setFlash(null);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const tick = () => {
    const s = state.current;
    if (s.liquidated) return stop();
    const next = Math.round(s.price * (1 - STEP));
    if (next < FLOOR) return stop();
    const before = healthFactor(s.pos, next);
    if (before < 1) {
      // The market liquidates before anything else can happen at this price.
      setPrice(next); setLiquidated(true); setFlash("threat");
      setEvents(e => [{ price: next, outcome: "Liquidated", amount: 0, hfBefore: before, hfAfter: before }, ...e]);
      return stop();
    }
    const r = evaluate(s.pos, next, { triggerHF: TRIGGER, targetHF: TARGET, maxSpend: PRESETS[preset].maxSpend }, s.spent, s.reserve);
    setPrice(next);
    if (r.outcome !== "NotNeeded") {
      setEvents(e => [{ price: next, outcome: r.outcome, amount: r.amount, hfBefore: r.hfBefore, hfAfter: r.hfAfter }, ...e]);
      setFlash(r.outcome === "Rescued" || r.outcome === "PartiallyRescued" ? "rescue" : "threat");
      setPos(r.position); setSpent(r.spent); setReserve(r.reserve);
    }
  };
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setRunning(false); };
  const crash = () => {
    if (running) return;
    if (liquidated || price <= FLOOR * 1.04) reset();
    setRunning(true);
    timer.current = setInterval(tick, 650);
  };

  const hf = healthFactor(pos, price);
  const danger = Math.min(1, Math.max(0, (START.price - price) / (START.price - FLOOR)));
  const last = events[0];
  const triggerPrice = priceAtHF(pos, TRIGGER);
  const status = liquidated ? "Liquidated" : last?.outcome === "Rescued" || last?.outcome === "PartiallyRescued" ? "Position protected" : hf < TRIGGER ? "Threat detected" : running ? "Watching every price event" : "Healthy";

  return (
    <section id="simulate" className="relative overflow-hidden py-32">
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: liquidated ? 1 : danger * 0.8, background: "radial-gradient(60% 50% at 50% 50%, rgb(255 59 59 / 0.22), transparent 70%)" }} />
      <div className={`pointer-events-none absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-[1400ms] ease-out ${flash === "rescue" ? "scale-100 opacity-100" : "scale-0 opacity-0"}`} style={{ background: "radial-gradient(circle, rgb(34 227 154 / 0.16) 0%, rgb(34 227 154 / 0.06) 35%, transparent 60%)" }} onTransitionEnd={() => flash === "rescue" && setFlash(null)} />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <Eyebrow>Interactive rescue</Eyebrow>
        <h2 className="section-title max-w-3xl">Don&apos;t just watch protection. Experience it.</h2>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-dim">Trigger a market crash. Each price drop is one on-chain price event; below your trigger, the vault&apos;s real decision logic runs on every one.</p>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PRESETS) as PresetKey[]).map(k => (
                  <button key={k} onClick={() => { setPreset(k); reset(k); }} className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${preset === k ? "border-bull/50 bg-bull/10 text-bull" : "border-white/10 text-dim hover:text-text"}`}>{PRESETS[k].label}</button>
                ))}
              </div>
              <span className="rounded-full border border-bear/30 bg-bear/10 px-3 py-1 text-[11px] font-semibold text-bear">Simulation · no transaction sent</span>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="WETH price" value={`$${price.toLocaleString("en-US")}`} tone={danger > 0.3 ? "text-bear" : ""} />
              <Metric label="Collateral value" value={`$${Math.round(pos.collateral * price).toLocaleString("en-US")}`} sub={`${pos.collateral} WETH`} />
              <Metric label="Borrowed" value={`${Math.round(pos.debt).toLocaleString("en-US")} USDC`} />
              <Metric label="Health factor" value={Number.isFinite(hf) ? hf.toFixed(2) : "∞"} tone={hf < 1 ? "text-bear" : hf < TRIGGER ? "text-bear" : "text-bull"} />
              <Metric label="Rescue threshold" value={`HF ${TRIGGER.toFixed(2)}`} sub={`≈ $${Math.round(triggerPrice).toLocaleString("en-US")} WETH`} />
              <Metric label="Reserve left" value={`${Math.round(reserve).toLocaleString("en-US")} USDC`} sub={`budget ${Math.round(PRESETS[preset].maxSpend - spent).toLocaleString("en-US")} left`} />
            </div>

            <HFBar hf={hf} />

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={crash} disabled={running} className="cta-danger"><Zap className="h-4 w-4" />{running ? "Market crashing…" : liquidated || price < START.price ? "Crash again" : "Trigger market crash"}</button>
              <button onClick={() => reset()} className="cta-ghost !py-3"><RotateCcw className="h-4 w-4" />Reset</button>
            </div>
          </div>

          <div className={`relative overflow-hidden rounded-[32px] border p-6 transition-colors duration-500 sm:p-8 ${liquidated ? "border-bear/40 bg-bear/[0.06]" : status === "Position protected" ? "border-bull/40 bg-bull/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="flex items-center gap-3">
              {liquidated ? <ShieldAlert className="h-6 w-6 text-bear" /> : <ShieldCheck className={`h-6 w-6 ${status === "Position protected" ? "text-bull" : "text-dim"}`} />}
              <div className="text-[22px] font-semibold tracking-tight">{status}</div>
            </div>
            {last && (last.outcome === "Rescued" || last.outcome === "PartiallyRescued") && (
              <div className="mt-5 space-y-1.5 font-mono text-[13px]">
                <div className="text-bear">› Threat detected at ${last.price.toLocaleString("en-US")} (HF {last.hfBefore.toFixed(2)})</div>
                <div className="text-white">› Rescue initiated: repay {last.amount.toFixed(2)} USDC</div>
                <div className="text-bull">› {last.outcome === "Rescued" ? "Position protected" : "Partly protected: budget or reserve ran out"}: HF {last.hfAfter.toFixed(2)}</div>
              </div>
            )}
            {liquidated && <p className="mt-4 text-[14px] leading-relaxed text-bear/90">The health factor fell below 1.0 before a rescue could restore it{preset !== "funded" ? ": the reserve wasn't enough" : ""}. On the market, a liquidator now takes the collateral. Protection only works with a funded reserve.</p>}
            <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-dim">Vault decisions</div>
            <ul className="mt-2 max-h-[230px] space-y-1.5 overflow-auto pr-1">
              {events.length === 0 && <li className="text-[13px] text-dim">No events below the trigger yet. Trigger a crash.</li>}
              {events.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-[12px]">
                  <span className="text-dim">${e.price.toLocaleString("en-US")}</span>
                  <span className={OUTCOME_TONE[e.outcome]}>{e.outcome}</span>
                  <span className="text-dim">{e.amount > 0 ? `${e.amount.toFixed(0)} USDC` : "-"}</span>
                  <span>{e.hfBefore.toFixed(2)} → {e.hfAfter.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[12px] leading-relaxed text-dim">Same formula as <span className="font-mono">ProtectionVault._repayToReach</span>: repay = debt − collateral × price × 0.8 ÷ target, capped by the remaining budget and the reserve. Liquidation at HF &lt; 1, as in the test market. On-chain rescues are shown in the <a href="/app" className="text-bull underline-offset-2 hover:underline">app</a>.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const OUTCOME_TONE: Record<string, string> = { Rescued: "text-bull", PartiallyRescued: "text-bear", BudgetExhausted: "text-bear", NoReserve: "text-bear", Liquidated: "text-bear", NotNeeded: "text-dim", AlreadyLiquidated: "text-bear" };

function Metric({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3.5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-dim">{label}</div>
      <div className={`mt-1 font-mono text-[19px] font-medium ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-dim">{sub}</div>}
    </div>
  );
}

function HFBar({ hf }: { hf: number }) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - 0.8) / (1.9 - 0.8)) * 100))}%`;
  return (
    <div className="mt-7">
      <div className="relative h-3 rounded-full bg-[linear-gradient(90deg,#ff3b3b_0%,#ff3b3b_32%,#22e39a_70%,#22e39a_100%)] opacity-90">
        {[[1, "liquidation"], [TRIGGER, "trigger"], [TARGET, "target"]].map(([v, l]) => (
          <span key={l as string} className="absolute top-full mt-1.5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-dim" style={{ left: pct(v as number) }}>{(v as number).toFixed(2)} {l}</span>
        ))}
        {[1, TRIGGER, TARGET].map(v => <span key={v} className="absolute top-[-3px] h-[18px] w-px bg-white/50" style={{ left: pct(v) }} />)}
        {Number.isFinite(hf) && <span className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#04060d] bg-white shadow-[0_0_20px_rgb(255_255_255/0.5)] transition-all duration-500" style={{ left: pct(hf) }} />}
      </div>
    </div>
  );
}
