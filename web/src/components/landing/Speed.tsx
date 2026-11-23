"use client";
// Polling vs event-driven, on a shared clock. A price drop lands at DROP seconds; a keeper that polls every `interval`
// seconds first sees it at its next poll, while the reactive path starts from the event itself. Measured testnet
// latency (from contracts/scripts/latency.ts) is shown only when it exists: no number here is made up.
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Eyebrow } from "./Landing";

export interface LatencySummary {
  completed: number;
  loopSeconds: { median: number | null; p90: number | null };
  loopEstimatedMs: { median: number | null; p90: number | null };
  originBlockTimeMs: number | null;
  medianBlocks: number | null;
  example: { origin: string; reactive: string; callback: string } | null;
  explorers: { origin: string; reactive: string };
  measuredAt: string;
}

const CYCLE = 16, DROP = 3.2;

export function Speed({ latency }: { latency: LatencySummary | null }) {
  const [interval, setInterval_] = useState(12);
  const [t, setT] = useState(0);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setStill(reduced);
    if (reduced) { setT(CYCLE * 0.85); return; }
    let raf = 0; const t0 = performance.now();
    const loop = (now: number) => { setT(((now - t0) / 1000) % CYCLE); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const polls = Array.from({ length: Math.floor(CYCLE / interval) + 1 }, (_, i) => i * interval).filter(p => p <= CYCLE);
  const seen = polls.find(p => p >= DROP) ?? null;
  const pct = (s: number) => `${(s / CYCLE) * 100}%`;
  const dropped = t >= DROP;

  return (
    <section id="speed" className="relative py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Eyebrow>Speed is our advantage</Eyebrow>
        <h2 className="section-title max-w-3xl">Seconds aren&apos;t just numbers. They&apos;re your collateral.</h2>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-dim">A keeper that polls every few seconds can't see a crash until its next check, so it adds up to one polling interval before it even starts. An event-driven rescue starts from the price event itself.</p>

        <div className="mt-10 grid overflow-hidden rounded-[32px] border border-white/10 md:grid-cols-2">
          <Lane title="Polling keeper" sub={`checks every ${interval} s`} tone="orange">
            <Track pct={pct} t={t} dropped={dropped}>
              {polls.map(p => <span key={p} className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition ${t >= p && t < p + 0.5 ? "scale-150 bg-bear shadow-[0_0_16px_#ff3b3b]" : "bg-bear/30"}`} style={{ left: pct(p) }} />)}
              {seen !== null && dropped && <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-bear/40" style={{ left: pct(DROP), width: pct(Math.min(t, seen) - DROP) }} />}
            </Track>
            <p className="mt-4 text-[14px] text-dim">
              {seen === null ? <>The next check is after this window: the drop goes unseen for over {Math.round(CYCLE - DROP)} s.</> : <>Sees the drop at its next check, <span className="font-mono text-bear">{(seen - DROP).toFixed(1)} s</span> later in this example, and up to <span className="font-mono text-bear">{interval} s</span> in the worst case, before any transaction.</>}
            </p>
            <label className="mt-4 flex items-center gap-3 text-[12px] text-dim">Polling interval
              <input type="range" min={2} max={30} value={interval} onChange={e => setInterval_(Number(e.target.value))} className="flex-1 accent-bear" />
              <span className="w-10 font-mono text-text">{interval} s</span>
            </label>
          </Lane>
          <Lane title="LiquidationRescue" sub="reacts to the emitted event" tone="cyan">
            <Track pct={pct} t={t} dropped={dropped}>
              <span className="liquid-stream absolute inset-y-[38%] left-0 right-0 rounded-full" />
              {dropped && <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bull shadow-[0_0_24px_#22e39a]" style={{ left: pct(DROP) }} />}
            </Track>
            <p className="mt-4 text-[14px] text-dim">No polling gap: the price event itself starts the loop: <span className="font-mono text-bull">event → react() → vault callback</span>.</p>
          </Lane>
        </div>

        {latency ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Median full loop" value={`${latency.loopSeconds.median} s`} sub={latency.loopEstimatedMs.median !== null ? `≈ ${latency.loopEstimatedMs.median} ms by block count` : undefined} />
            <Stat label="P90 full loop" value={`${latency.loopSeconds.p90} s`} sub={latency.loopEstimatedMs.p90 !== null ? `≈ ${latency.loopEstimatedMs.p90} ms` : undefined} />
            <Stat label="Full loop, blocks" value={latency.medianBlocks !== null ? `${latency.medianBlocks} blocks` : "-"} sub={latency.originBlockTimeMs ? `Base Sepolia ≈ ${latency.originBlockTimeMs} ms/block` : undefined} />
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-[11px] uppercase tracking-[0.14em] text-dim">Verified transactions</div>
              {latency.example ? (
                <ul className="mt-2 space-y-1 text-[13px]">
                  <li><a className="inline-flex items-center gap-1 text-bear hover:underline" href={`${latency.explorers.origin}/tx/${latency.example.origin}`}>Price event <ExternalLink className="h-3 w-3" /></a></li>
                  <li><a className="inline-flex items-center gap-1 text-white hover:underline" href={`${latency.explorers.reactive}/tx/${latency.example.reactive}`}>Reactive (Lasna) <ExternalLink className="h-3 w-3" /></a></li>
                  <li><a className="inline-flex items-center gap-1 text-bull hover:underline" href={`${latency.explorers.origin}/tx/${latency.example.callback}`}>Vault rescue <ExternalLink className="h-3 w-3" /></a></li>
                </ul>
              ) : <div className="mt-2 text-[13px] text-dim">-</div>}
              <div className="mt-2 text-[11px] text-dim">{latency.completed} rescues measured · {new Date(latency.measuredAt).toUTCString().slice(5, 16)}</div>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[15px] font-semibold">Measured testnet latency appears here once it exists.</div>
              <div className="mt-1 text-[13px] text-dim">We don&apos;t publish estimates: median and P90 full-loop time, block count and the three transaction links come from <span className="font-mono">npm run latency</span> on the Base Sepolia ↔ Lasna deployment.</div>
            </div>
            <a href="https://github.com/BernardOnuh/liquidationrescue#latency-every-second-counts" className="cta-ghost shrink-0 !py-2.5 text-[13px]">How it&apos;s measured</a>
          </div>
        )}
        {still && <p className="mt-3 text-[12px] text-dim">Animation paused (reduced motion).</p>}
      </div>
    </section>
  );
}

function Lane({ title, sub, tone, children }: { title: string; sub: string; tone: "orange" | "cyan"; children: React.ReactNode }) {
  return (
    <div className={`p-6 sm:p-8 ${tone === "orange" ? "bg-[linear-gradient(160deg,rgb(255_59_59/0.08),transparent_60%)]" : "border-t border-white/10 bg-[linear-gradient(160deg,rgb(34_227_154/0.09),transparent_60%)] md:border-l md:border-t-0"}`}>
      <div className="flex items-baseline justify-between"><div className="text-[19px] font-semibold">{title}</div><div className={`font-mono text-[12px] ${tone === "orange" ? "text-bear" : "text-bull"}`}>{sub}</div></div>
      {children}
    </div>
  );
}

function Track({ children, pct, t, dropped }: { children: React.ReactNode; pct: (s: number) => string; t: number; dropped: boolean }) {
  return (
    <div className="relative mt-6 h-16">
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
      <div className="absolute top-1 -translate-x-1/2 text-[11px] font-semibold text-bear transition-opacity" style={{ left: pct(DROP), opacity: dropped ? 1 : 0.35 }}>price drops</div>
      <div className="absolute inset-y-2 w-px bg-bear/60" style={{ left: pct(DROP) }} />
      {children}
      <div className="absolute inset-y-0 w-px bg-white/40" style={{ left: pct(t) }} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-dim">{label}</div>
      <div className="mt-1 font-mono text-[30px] font-medium text-bull">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-dim">{sub}</div>}
    </div>
  );
}
