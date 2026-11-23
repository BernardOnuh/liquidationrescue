"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Ban, CalendarClock, Fingerprint, Gauge, PauseCircle, PiggyBank, Target, Wallet } from "lucide-react";
import { CandleStorm, type StormPhase } from "./CandleStorm";
import { Simulator } from "./Simulator";
import { Speed, type LatencySummary } from "./Speed";
import { Magnetic } from "./Magnetic";

const REPO = "https://github.com/BernardOnuh/liquidationrescue";

export function Landing({ latency }: { latency: LatencySummary | null }) {
  useEffect(() => { gsap.registerPlugin(ScrollTrigger); }, []);
  return (
    <div className="landing relative overflow-x-clip bg-[#04060d] text-text">
      <Nav />
      <Hero />
      <Problem />
      <Solution />
      <Simulator />
      <Speed latency={latency} />
      <Control />
      <Final />
    </div>
  );
}

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.05] bg-[#04060d]/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <img src="/logo.svg" alt="" className="h-7 w-7" />
          <span>LiquidationRescue</span>
        </Link>
        <nav className="hidden items-center gap-7 text-[13px] text-dim md:flex">
          <a href="#problem" className="hover:text-text">The risk</a>
          <a href="#how" className="hover:text-text">How it works</a>
          <a href="#simulate" className="hover:text-text">Try a crash</a>
          <a href="#speed" className="hover:text-text">Speed</a>
          <a href={REPO} className="hover:text-text">GitHub</a>
        </nav>
        <Link href="/app" className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-[13px] font-semibold backdrop-blur-md transition hover:border-cyan-300/50 hover:bg-cyan-300/10">Launch app</Link>
      </div>
    </header>
  );
}

// ---------- 1. Hero ----------
function Hero() {
  const [phase, setPhase] = useState<StormPhase>("calm");
  const message = phase === "shield" || phase === "rally";
  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden">
      <div className={`pointer-events-none absolute inset-0 -z-10 transition-colors duration-1000 ${phase === "crash" ? "bg-[radial-gradient(60%_60%_at_70%_50%,rgb(255_70_20/0.16),transparent_70%)]" : "bg-[radial-gradient(60%_60%_at_70%_50%,rgb(34_211_238/0.12),transparent_70%)]"}`} />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_60%,#04060d)]" />
      <CandleStorm onPhase={setPhase} className="absolute inset-x-0 top-14 -z-10 h-[44svh] w-full md:inset-y-0 md:left-[36%] md:top-0 md:h-full md:w-[64%]" />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-[52svh] sm:px-8 md:pb-20 md:pt-28">
        <div className="max-w-[640px]">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] text-dim backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#67e8f9]" /> Event-driven liquidation protection · Reactive Network
          </p>
          <h1 className="text-[44px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[72px] lg:text-[88px]">
            Before the market <span className="bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">breaks you.</span>
            <br /><span className="bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-400 bg-clip-text text-transparent">We react.</span>
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-dim sm:text-[19px]">
            Markets crash without warning. LiquidationRescue detects risk and triggers automated protection for your DeFi positions, powered by Reactive Smart Contracts.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Magnetic><Link href="/app" className="cta-primary">Protect My Position <ArrowRight className="h-4 w-4" /></Link></Magnetic>
            <Magnetic><a href="#how" className="cta-ghost">See How It Works</a></Magnetic>
          </div>
        </div>
      </div>
      <div aria-live="polite" className={`pointer-events-none absolute left-1/2 top-[44svh] -translate-x-1/2 transition-all duration-700 md:bottom-[12%] md:left-[67%] md:top-auto ${message ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
        <div className="whitespace-nowrap rounded-full border border-cyan-300/30 bg-cyan-300/[0.08] px-5 py-2 text-[13px] font-medium tracking-wide text-cyan-100 shadow-[0_0_40px_-6px_rgb(34_211_238/0.6)] backdrop-blur-md">
          Risk detected. <span className="text-cyan-300">Protection triggered.</span>
        </div>
      </div>
    </section>
  );
}

// ---------- 2. The problem: scroll lowers the price ----------
const POS = { collateral: 2, debt: 3200, from: 3200, to: 1850 };

function Problem() {
  const root = useRef<HTMLElement>(null);
  const price = useRef<HTMLSpanElement>(null), hf = useRef<HTMLSpanElement>(null), bar = useRef<HTMLDivElement>(null), label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      const draw = (p: number) => {
        const pr = POS.from + (POS.to - POS.from) * p;
        const h = (POS.collateral * pr * 0.8) / POS.debt;
        if (price.current) price.current.textContent = `$${pr.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
        if (hf.current) { hf.current.textContent = h.toFixed(2); hf.current.style.color = h < 1 ? "#fb7185" : h < 1.2 ? "#fbbf24" : "#67e8f9"; }
        if (bar.current) { bar.current.style.width = `${Math.min(100, Math.max(4, (h / 1.8) * 100))}%`; bar.current.style.background = h < 1 ? "linear-gradient(90deg,#f43f5e,#ff7a45)" : h < 1.2 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#0ea5e9,#67e8f9)"; }
        if (label.current) label.current.textContent = h < 1 ? "Liquidatable" : h < 1.2 ? "At risk" : "Healthy";
        root.current?.style.setProperty("--p", String(p));
      };
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        ScrollTrigger.create({ trigger: root.current, start: "top top", end: "+=160%", pin: ".problem-stage", scrub: 0.6, onUpdate: s => draw(s.progress) });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => draw(1));
      draw(0);
    }, root);
    return () => ctx.revert();
  }, []);
  return (
    <section id="problem" ref={root} className="relative" style={{ ["--p" as string]: 0 }}>
      <div className="problem-stage relative flex min-h-[100svh] items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_50%,rgb(244_63_94/0.22),transparent_70%)]" style={{ opacity: "var(--p)" }} />
        <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: "calc(var(--p) * 0.45)" }} />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 sm:px-8 md:grid-cols-2">
          <LiquidStructure />
          <div>
            <Eyebrow>The problem · Liquidation never waits</Eyebrow>
            <h2 className="section-title">One price drop.<br />Everything at risk.</h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-dim">When collateral prices fall, your borrowing position can move toward liquidation. Traditional monitoring depends on someone, or something, noticing the danger in time.</p>
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
              <div className="flex items-end justify-between">
                <div><div className="text-[11px] uppercase tracking-[0.16em] text-dim">WETH price</div><span ref={price} className="font-mono text-[28px] font-medium">$3,200</span></div>
                <div className="text-right"><div className="text-[11px] uppercase tracking-[0.16em] text-dim">Health factor</div><span ref={hf} className="font-mono text-[28px] font-medium text-cyan-300">1.60</span></div>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.06]"><div ref={bar} className="h-full rounded-full" style={{ width: "89%" }} /></div>
              <div className="mt-2 flex justify-between text-[12px] text-dim"><span>2 WETH collateral · 3,200 USDC borrowed</span><span ref={label}>Healthy</span></div>
            </div>
            <p className="mt-8 text-[20px] font-medium tracking-tight text-text" style={{ opacity: "clamp(0, calc((var(--p) - 0.75) * 4), 1)" }}>When every second matters, waiting isn&apos;t protection.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LiquidStructure() {
  // A blue liquid body; scroll progress (--p) floods it red and draws fractures through it.
  const cracks = ["M210 120 L232 178 L214 214 L250 262 L236 320", "M300 150 L284 206 L318 246 L296 300", "M150 230 L196 250 L188 300 L226 338", "M330 230 L296 268 L332 312 L300 360", "M240 90 L262 140 L244 168"];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px]">
      <svg viewBox="0 0 480 480" className="h-full w-full">
        <defs>
          <filter id="liquid"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="4"><animate attributeName="baseFrequency" dur="14s" values="0.012;0.018;0.012" repeatCount="indefinite" /></feTurbulence><feDisplacementMap in="SourceGraphic" scale="38" /></filter>
          <radialGradient id="blue" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#d6f7ff" /><stop offset="0.25" stopColor="#38bdf8" /><stop offset="0.7" stopColor="#1e3a8a" /><stop offset="1" stopColor="#0b1026" /></radialGradient>
          <radialGradient id="red" cx="50%" cy="60%" r="70%"><stop offset="0" stopColor="#ffb07a" /><stop offset="0.4" stopColor="#f43f5e" /><stop offset="1" stopColor="#3b0712" /></radialGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g filter="url(#liquid)">
          <circle cx="240" cy="240" r="150" fill="url(#blue)" />
          <circle cx="240" cy="240" r="150" fill="url(#red)" style={{ opacity: "var(--p)" }} />
          <ellipse cx="196" cy="180" rx="56" ry="26" fill="white" opacity="0.18" />
        </g>
        <g filter="url(#glow)" fill="none" stroke="#ffd1b3" strokeWidth="2.2" strokeLinecap="round">
          {cracks.map((d, i) => <path key={i} d={d} pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: `calc(1 - clamp(0, (var(--p) - ${0.15 + i * 0.12}) * 3, 1))` }} />)}
        </g>
      </svg>
    </div>
  );
}

// ---------- 3. The solution: detect → react → rescue ----------
function Solution() {
  const root = useRef<HTMLElement>(null);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const p1 = root.current!.querySelector<SVGPathElement>("#hop1")!, p2 = root.current!.querySelector<SVGPathElement>("#hop2")!;
      const pulse = root.current!.querySelector<SVGCircleElement>("#pulse")!, halo = root.current!.querySelector<SVGCircleElement>("#pulse-halo")!;
      const L1 = p1.getTotalLength(), L2 = p2.getTotalLength();
      const place = (p: number) => {
        let pt: DOMPoint, col: string;
        if (p < 0.3) { pt = p1.getPointAtLength(0); col = "#ff5a1f"; }
        else if (p < 0.62) { pt = p1.getPointAtLength(((p - 0.3) / 0.32) * L1); col = p < 0.5 ? "#ff7a45" : "#a78bfa"; }
        else { pt = p2.getPointAtLength(Math.min(1, (p - 0.62) / 0.3) * L2); col = "#67e8f9"; }
        for (const c of [pulse, halo]) { c.setAttribute("cx", String(pt.x)); c.setAttribute("cy", String(pt.y)); c.setAttribute("fill", col); }
        setStage(p < 0.3 ? 0 : p < 0.62 ? 1 : 2);
        root.current?.style.setProperty("--s", String(p));
      };
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        ScrollTrigger.create({ trigger: root.current, start: "top top", end: "+=200%", pin: ".solution-stage", scrub: 0.6, onUpdate: s => place(s.progress) });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => place(1));
      place(0);
    }, root);
    return () => ctx.revert();
  }, []);
  const stages = [
    { k: "DETECT", t: "A price event on Base Sepolia", d: "The oracle publishes a lower price. That event is the trigger: nobody has to notice it." },
    { k: "REACT", t: "Reactive Network on Lasna", d: "A reactive contract subscribed to the price feed runs react(), finds protected positions and requests a callback." },
    { k: "RESCUE", t: "ProtectionVault on Base Sepolia", d: "The vault rechecks the position and repays just enough debt to reach your target health factor, within your limits." },
  ];
  return (
    <section id="how" ref={root} className="relative">
      <div className="solution-stage relative flex min-h-[100svh] flex-col justify-center overflow-hidden py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_45%,rgb(34_211_238/0.10),transparent_70%)]" />
        <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
          <Eyebrow>The solution · We react</Eyebrow>
          <h2 className="section-title max-w-3xl">The moment risk appears, protection begins.</h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-dim">LiquidationRescue uses Reactive Smart Contracts to respond to on-chain price events and initiate a calculated rescue, without relying on periodic polling.</p>
          <svg viewBox="0 0 1200 300" className="mt-10 w-full">
            <defs>
              <linearGradient id="g1" x1="0" x2="1"><stop offset="0" stopColor="#ff5a1f" /><stop offset="1" stopColor="#a78bfa" /></linearGradient>
              <linearGradient id="g2" x1="0" x2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
              <filter id="soft"><feGaussianBlur stdDeviation="6" /></filter>
            </defs>
            {[["#hop1", "M252 150 C 380 40, 470 260, 538 150", "url(#g1)"], ["#hop2", "M662 150 C 790 40, 880 260, 948 150", "url(#g2)"]].map(([id, d, s]) => (
              <g key={id}>
                <path d={d} stroke={s} strokeWidth="16" fill="none" opacity="0.18" filter="url(#soft)" />
                <path id={id.slice(1)} d={d} stroke={s} strokeWidth="3" fill="none" className="liquid-flow" />
              </g>
            ))}
            <Node x={190} label="Base Sepolia" sub="Price feed" tone="#ff5a1f" on={stage >= 0} />
            <Node x={600} label="Reactive Lasna" sub="react()" tone="#a78bfa" on={stage >= 1} />
            <Node x={1010} label="Base Sepolia" sub="ProtectionVault" tone="#22d3ee" on={stage >= 2} />
            <circle id="pulse-halo" r="26" opacity="0.35" filter="url(#soft)" />
            <circle id="pulse" r="9" />
          </svg>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {stages.map((s, i) => (
              <div key={s.k} className={`rounded-3xl border p-5 transition-all duration-500 ${stage === i ? "border-cyan-300/40 bg-cyan-300/[0.06] shadow-[0_0_60px_-20px_rgb(34_211_238/0.6)]" : "border-white/10 bg-white/[0.02] opacity-60"}`}>
                <div className="font-mono text-[12px] tracking-[0.2em]" style={{ color: ["#ff7a45", "#a78bfa", "#67e8f9"][i] }}>0{i + 1} · {s.k}</div>
                <div className="mt-2 text-[17px] font-semibold">{s.t}</div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-dim">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Node({ x, label, sub, tone, on }: { x: number; label: string; sub: string; tone: string; on: boolean }) {
  return (
    <g style={{ transition: "opacity .5s", opacity: on ? 1 : 0.45 }}>
      <circle cx={x} cy={150} r={on ? 76 : 70} fill={tone} opacity={on ? 0.16 : 0.06} style={{ transition: "all .5s" }} />
      <circle cx={x} cy={150} r={60} fill="#0a0f1d" stroke={tone} strokeWidth="2" />
      <text x={x} y={146} textAnchor="middle" fill="#e8ecf5" fontSize="15" fontWeight="600">{label}</text>
      <text x={x} y={166} textAnchor="middle" fill="#8c96ab" fontSize="12" fontFamily="JetBrains Mono, monospace">{sub}</text>
    </g>
  );
}

// ---------- 6. Control ----------
function Control() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".rule").forEach(el => {
        ScrollTrigger.create({ trigger: el, start: "top 78%", onEnter: () => el.classList.add("rule-on"), onLeaveBack: () => el.classList.remove("rule-on") });
      });
    }, root);
    return () => ctx.revert();
  }, []);
  const rules: [ReactNode, string, string, string][] = [
    [<Gauge key="a" className="h-5 w-5" />, "Rescue threshold", "Act when health factor falls below", "1.20"],
    [<Target key="b" className="h-5 w-5" />, "Target health factor", "Repay just enough to get back to", "1.50"],
    [<Wallet key="c" className="h-5 w-5" />, "Maximum repayment", "Lifetime spend cap, kept across policy changes", "1,500 USDC"],
    [<PiggyBank key="d" className="h-5 w-5" />, "Funded rescue reserve", "Your own USDC, withdrawable any time", "1,000 USDC"],
    [<CalendarClock key="e" className="h-5 w-5" />, "Policy expiration", "No rescues after this date", "30 days"],
    [<PauseCircle key="f" className="h-5 w-5" />, "Emergency pause", "Stop all rescues with one transaction", "Ready"],
    [<Fingerprint key="g" className="h-5 w-5" />, "Replay protection", "Each price event can spend only once", "Always on"],
  ];
  return (
    <section ref={root} className="relative py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Eyebrow>Protection with control</Eyebrow>
          <h2 className="section-title">Automated protection.<br />Your rules.</h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-dim">Set your limits. Fund your reserve. Let the protocol react when the market moves against you.</p>
          <p className="mt-4 flex max-w-md items-start gap-2 text-[14px] text-dim"><Ban className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" /> Stale prices are rejected, and the vault never spends beyond your budget or your reserve.</p>
        </div>
        <div className="vault relative rounded-[36px] p-[1px]">
          <div className="relative overflow-hidden rounded-[35px] bg-[#070b16]/80 p-6 backdrop-blur-xl sm:p-8">
            <div className="vault-liquid pointer-events-none absolute -inset-20 opacity-60" />
            <div className="relative mb-5 flex items-center justify-between">
              <span className="font-mono text-[12px] tracking-[0.2em] text-cyan-300">PROTECTIONVAULT · POLICY</span>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">Active</span>
            </div>
            <ul className="relative space-y-2.5">
              {rules.map(([icon, t, d, v]) => (
                <li key={t} className="rule flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
                  <span className="rule-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-dim">{icon}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{t}</span><span className="block truncate text-[13px] text-dim">{d}</span></span>
                  <span className="rule-value font-mono text-[14px] text-dim">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 7. Final ----------
function Final() {
  return (
    <section className="relative isolate overflow-hidden pb-16 pt-24">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_40%,rgb(34_211_238/0.14),transparent_70%)]" />
      <CandleStorm mode="calm" className="mx-auto block h-[300px] w-full max-w-[760px] sm:h-[380px]" />
      <div className="mx-auto max-w-3xl px-5 text-center">
        <h2 className="section-title">The market won&apos;t wait.<br />Why should your protection?</h2>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-dim">Take control of liquidation risk with event-driven, automated DeFi protection.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Magnetic><Link href="/app" className="cta-primary">Launch LiquidationRescue <ArrowRight className="h-4 w-4" /></Link></Magnetic>
          <Magnetic><a href={REPO} className="cta-ghost">Explore the Protocol</a></Magnetic>
        </div>
        <p className="mt-16 font-mono text-[12px] tracking-[0.14em] text-dim">BUILT WITH REACTIVE NETWORK · BASE SEPOLIA TESTNET</p>
        <p className="mt-2 text-[12px] text-dim/70">Testnet only. Not audited. Test tokens have no value.</p>
      </div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="mb-4 font-mono text-[12px] uppercase tracking-[0.2em] text-cyan-300/90">{children}</div>;
}
