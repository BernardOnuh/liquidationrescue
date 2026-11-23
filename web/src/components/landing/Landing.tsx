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

const LINKS: [string, string][] = [["problem", "The risk"], ["how", "How it works"], ["simulate", "Try a crash"], ["speed", "Speed"]];

/** The mark: a shield holding one red candle (the crash) and one green candle (the rescue). */
function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M16 2.5 27 6.6v8.1c0 7.3-4.7 12.2-11 14.8C9.7 26.9 5 22 5 14.7V6.6Z" fill="rgb(34 227 154 / 0.1)" stroke="#22e39a" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12.2 9.5v12.5" stroke="#ff3b3b" strokeWidth="1.2" strokeLinecap="round" /><rect x="10.4" y="11.5" width="3.6" height="7.5" rx="0.8" fill="#ff3b3b" />
      <path d="M19.8 8v11.5" stroke="#22e39a" strokeWidth="1.2" strokeLinecap="round" /><rect x="18" y="9.5" width="3.6" height="7" rx="0.8" fill="#22e39a" />
    </svg>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    // highlight the section in the middle of the screen
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-45% 0px -50% 0px" });
    LINKS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => { window.removeEventListener("scroll", onScroll); io.disconnect(); };
  }, []);
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div className={`mx-auto flex max-w-6xl items-center justify-between rounded-full border py-2 pl-3 pr-2 transition-all duration-300 sm:pl-4 ${scrolled || open ? "border-white/12 bg-[#05070c]/85 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.9)] backdrop-blur-xl" : "border-white/[0.07] bg-[#05070c]/40 backdrop-blur-md"}`}>
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Mark />
          <span className="font-display text-[17px] font-bold tracking-[-0.02em] text-white">Liquidation<span className="text-bull">Rescue</span></span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={`relative rounded-full px-3.5 py-2 text-[14px] font-medium transition ${active === id ? "bg-white/[0.07] text-white" : "text-[#c3cad6] hover:text-white"}`}>
              {active === id && <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-bull" />}
              <span className={active === id ? "pl-1.5" : ""}>{label}</span>
            </a>
          ))}
          <a href={REPO} className="rounded-full px-3.5 py-2 text-[14px] font-medium text-[#c3cad6] transition hover:text-white">GitHub</a>
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-white/12 px-2.5 py-1 font-mono text-[10.5px] tracking-[0.12em] text-[#c3cad6] lg:inline">TESTNET</span>
          <Link href="/app" className="hidden items-center gap-1.5 rounded-full bg-bull px-4 py-2 text-[14px] font-semibold text-[#03150d] transition hover:brightness-110 sm:inline-flex">Launch app <ArrowRight className="h-3.5 w-3.5" /></Link>
          <button onClick={() => setOpen(o => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} className="grid h-9 w-9 place-items-center rounded-full border border-white/12 md:hidden">
            <span className="relative block h-3 w-4">
              <span className={`absolute left-0 h-[1.5px] w-4 bg-white transition-all ${open ? "top-1.5 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 h-[1.5px] w-4 bg-white transition-all ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
            </span>
          </button>
        </div>
      </div>
      {open && (
        <div className="mx-auto mt-2 max-w-6xl rounded-3xl border border-white/12 bg-[#05070c]/95 p-2 backdrop-blur-xl md:hidden">
          {[...LINKS, [REPO, "GitHub"] as [string, string]].map(([id, label]) => (
            <a key={id} href={id.startsWith("http") ? id : `#${id}`} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-[16px] font-medium text-[#c3cad6] hover:bg-white/[0.05] hover:text-white">{label}</a>
          ))}
          <Link href="/app" onClick={() => setOpen(false)} className="mt-1 flex items-center justify-center gap-1.5 rounded-2xl bg-bull px-4 py-3 text-[16px] font-semibold text-[#03150d]">Launch app <ArrowRight className="h-4 w-4" /></Link>
        </div>
      )}
    </header>
  );
}

// ---------- 1. Hero ----------
function Hero() {
  const [phase, setPhase] = useState<StormPhase>("calm");
  const message = phase === "shield" || phase === "rally";
  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden">
      <div className={`pointer-events-none absolute inset-0 -z-10 transition-colors duration-1000 ${phase === "crash" ? "bg-[radial-gradient(60%_60%_at_70%_50%,rgb(255_59_59/0.16),transparent_70%)]" : "bg-[radial-gradient(60%_60%_at_70%_50%,rgb(34_227_154/0.08),transparent_70%)]"}`} />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_60%,#04060d)]" />
      <CandleStorm onPhase={setPhase} className="absolute inset-x-0 top-14 -z-10 h-[44svh] w-full md:inset-y-0 md:left-[50%] md:top-0 md:h-full md:w-[50%]" />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-[52svh] sm:px-8 md:pb-20 md:pt-28">
        <div className="max-w-[640px] md:max-w-[46%]">
          <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[12px] text-[#c3cad6] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-bull shadow-[0_0_10px_#22e39a]" /> Event-driven liquidation protection · Reactive Network
          </p>
          <h1 className="font-display text-[44px] font-bold leading-[0.96] tracking-[-0.035em] text-white sm:text-[68px] lg:text-[64px] xl:text-[72px]">
            Before the market<br /><span className="text-bear">breaks you.</span><br /><span className="text-bull">We react.</span>
          </h1>
          <p className="mt-7 max-w-[540px] text-[17px] leading-relaxed text-[#c3cad6] sm:text-[19px]">
            Markets crash without warning. LiquidationRescue detects risk and triggers automated protection for your DeFi positions, powered by Reactive Smart Contracts.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Magnetic><Link href="/app" className="cta-primary">Protect My Position <ArrowRight className="h-4 w-4" /></Link></Magnetic>
            <Magnetic><a href="#how" className="cta-ghost">See How It Works</a></Magnetic>
          </div>
        </div>
      </div>
      <div aria-live="polite" className={`pointer-events-none absolute left-1/2 top-[44svh] -translate-x-1/2 transition-all duration-700 md:bottom-[12%] md:left-[75%] md:top-auto ${message ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
        <div className="whitespace-nowrap rounded-full border border-bull/30 bg-bull/[0.08] px-5 py-2 text-[13px] font-medium tracking-wide text-bull shadow-[0_0_40px_-6px_rgb(34_227_154/0.6)] backdrop-blur-md">
          Risk detected. <span className="text-bull">Protection triggered.</span>
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
        if (hf.current) { hf.current.textContent = h.toFixed(2); hf.current.style.color = h < 1.2 ? "#ff3b3b" : "#22e39a"; }
        if (bar.current) { bar.current.style.width = `${Math.min(100, Math.max(4, (h / 1.8) * 100))}%`; bar.current.style.background = h < 1 ? "#ff3b3b" : h < 1.2 ? "#ff3b3b" : "#22e39a"; }
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
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_50%,rgb(255_59_59/0.22),transparent_70%)]" style={{ opacity: "var(--p)" }} />
        <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: "calc(var(--p) * 0.45)" }} />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 sm:px-8 md:grid-cols-2">
          <CrashChart />
          <div>
            <Eyebrow>The problem · Liquidation never waits</Eyebrow>
            <h2 className="section-title">One price drop.<br />Everything at risk.</h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-dim">When collateral prices fall, your borrowing position can move toward liquidation. Traditional monitoring depends on someone, or something, noticing the danger in time.</p>
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
              <div className="flex items-end justify-between">
                <div><div className="text-[11px] uppercase tracking-[0.16em] text-dim">WETH price</div><span ref={price} className="font-mono text-[28px] font-medium">$3,200</span></div>
                <div className="text-right"><div className="text-[11px] uppercase tracking-[0.16em] text-dim">Health factor</div><span ref={hf} className="font-mono text-[28px] font-medium text-bull">1.60</span></div>
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

// The price crash as candles, revealed by scroll progress (--p): no state, so it costs nothing per frame.
const CRASH = (() => {
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out: { o: number; c: number; h: number; l: number }[] = []; let p = POS.from; const N = 24;
  const weights = Array.from({ length: N }, (_, i) => (i < 5 ? 0.25 : i > 17 ? 2.1 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < N; i++) {
    const drift = ((POS.to - POS.from) * weights[i]) / total;
    const noise = i === N - 1 ? 0 : (rnd() - 0.5) * (i < 5 ? 130 : 170);
    const c = i === N - 1 ? Math.min(POS.to, p - 70) : p + drift + noise; // the last candle always closes lower
    out.push({ o: p, c, h: Math.max(p, c) + 15 + rnd() * 55, l: Math.min(p, c) - 15 - rnd() * 55 }); p = c;
  }
  return out;
})();
const LIQ_PRICE = POS.debt / (POS.collateral * 0.8); // HF = 1 → $2,000

function CrashChart() {
  const lo = 1700, hi = 3400, Y = (v: number) => 380 - ((v - lo) / (hi - lo)) * 340, step = 18.2, w = 12;
  return (
    <div className="relative mx-auto w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#05070c]/80 p-3">
      <div className="flex items-center justify-between px-2 pb-2 pt-1 font-mono text-[11px] tracking-[0.12em] text-[#c3cad6]"><span>WETH / USD</span><span className="text-bear" style={{ opacity: "var(--p)" }}>▼ CRASH</span></div>
      <svg viewBox="0 0 500 400" className="w-full">
        {[3200, 2800, 2400, 2000].map(v => (
          <g key={v}><line x1="0" x2="452" y1={Y(v)} y2={Y(v)} stroke="rgb(255 255 255 / 0.06)" /><text x="496" y={Y(v) + 4} textAnchor="end" fill="#8c96ab" fontSize="11" fontFamily="JetBrains Mono, monospace">{v.toLocaleString("en-US")}</text></g>
        ))}
        <rect x="0" y={Y(LIQ_PRICE)} width="452" height={400 - Y(LIQ_PRICE)} fill="rgb(255 59 59 / 0.12)" style={{ opacity: "var(--p)" }} />
        <line x1="0" x2="452" y1={Y(LIQ_PRICE)} y2={Y(LIQ_PRICE)} stroke="#ff3b3b" strokeDasharray="6 6" />
        <text x="8" y={Y(LIQ_PRICE) + 18} fill="#ff3b3b" fontSize="11" fontWeight="600" fontFamily="JetBrains Mono, monospace">LIQUIDATION · HF 1.00 · $2,000</text>
        {CRASH.map((k, i) => {
          const x = 16 + i * step, up = k.c >= k.o, col = up ? "#22e39a" : "#ff3b3b";
          return (
            <g key={i} style={{ opacity: `clamp(0, calc(var(--p) * ${CRASH.length + 2} - ${i}), 1)` }}>
              <line x1={x} x2={x} y1={Y(k.h)} y2={Y(k.l)} stroke={col} strokeWidth="1.3" />
              <rect x={x - w / 2} y={Y(Math.max(k.o, k.c))} width={w} height={Math.max(2, Y(Math.min(k.o, k.c)) - Y(Math.max(k.o, k.c)))} fill={col} rx="1" />
            </g>
          );
        })}
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
        if (p < 0.3) { pt = p1.getPointAtLength(0); col = "#ff3b3b"; }
        else if (p < 0.62) { pt = p1.getPointAtLength(((p - 0.3) / 0.32) * L1); col = p < 0.5 ? "#ff3b3b" : "#e8ecf5"; }
        else { pt = p2.getPointAtLength(Math.min(1, (p - 0.62) / 0.3) * L2); col = "#22e39a"; }
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
        <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
          <Eyebrow>The solution · We react</Eyebrow>
          <h2 className="section-title max-w-3xl">The moment risk appears, protection begins.</h2>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-dim">LiquidationRescue uses Reactive Smart Contracts to respond to on-chain price events and initiate a calculated rescue, without relying on periodic polling.</p>
          <svg viewBox="0 0 1200 300" className="mt-10 w-full">
            <defs>
              <linearGradient id="g1" x1="0" x2="1"><stop offset="0" stopColor="#ff3b3b" /><stop offset="1" stopColor="#e8ecf5" /></linearGradient>
              <linearGradient id="g2" x1="0" x2="1"><stop offset="0" stopColor="#e8ecf5" /><stop offset="1" stopColor="#22e39a" /></linearGradient>
            </defs>
            {[["#hop1", "M300 150 H490", "url(#g1)"], ["#hop2", "M710 150 H900", "url(#g2)"]].map(([id, d, s]) => (
              <g key={id}>
                <path d={d} stroke="rgb(255 255 255 / 0.08)" strokeWidth="10" fill="none" strokeLinecap="round" />
                <path id={id.slice(1)} d={d} stroke={s} strokeWidth="2.5" fill="none" className="liquid-flow" />
              </g>
            ))}
            <Node x={190} chain="BASE SEPOLIA" title="Price feed" line="PriceUpdated event" tone="#ff3b3b" on={stage >= 0} />
            <Node x={600} chain="REACTIVE LASNA" title="react()" line="RescueRequested" tone="#e8ecf5" on={stage >= 1} />
            <Node x={1010} chain="BASE SEPOLIA" title="ProtectionVault" line="onRiskEvent → repay" tone="#22e39a" on={stage >= 2} />
            <circle id="pulse-halo" r="0" opacity="0" />
            <circle id="pulse" r="6" />
          </svg>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {stages.map((s, i) => (
              <div key={s.k} className={`rounded-3xl border p-5 transition-all duration-500 ${stage === i ? "border-bull/40 bg-bull/[0.06] shadow-[0_0_60px_-20px_rgb(34_227_154/0.6)]" : "border-white/10 bg-white/[0.02] opacity-60"}`}>
                <div className="font-mono text-[12px] tracking-[0.2em]" style={{ color: ["#ff3b3b", "#e8ecf5", "#22e39a"][i] }}>0{i + 1} · {s.k}</div>
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

function Node({ x, chain, title, line, tone, on }: { x: number; chain: string; title: string; line: string; tone: string; on: boolean }) {
  return (
    <g style={{ transition: "opacity .5s", opacity: on ? 1 : 0.4 }}>
      <rect x={x - 110} y={98} width={220} height={104} rx="16" fill="#06080e" stroke={on ? tone : "rgb(255 255 255 / 0.14)"} strokeWidth={on ? 1.8 : 1.2} style={{ transition: "stroke .5s" }} />
      <rect x={x - 110} y={98} width={220} height={4} rx="2" fill={tone} opacity={on ? 1 : 0.3} />
      <text x={x - 92} y={130} fill={tone} fontSize="11" fontWeight="600" letterSpacing="1.6" fontFamily="JetBrains Mono, monospace">{chain}</text>
      <text x={x - 92} y={160} fill="#ffffff" fontSize="20" fontWeight="700" fontFamily="Space Grotesk, Inter Tight, sans-serif">{title}</text>
      <text x={x - 92} y={184} fill="#c3cad6" fontSize="12" fontFamily="JetBrains Mono, monospace">{line}</text>
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
          <p className="mt-4 flex max-w-md items-start gap-2 text-[14px] text-dim"><Ban className="mt-0.5 h-4 w-4 shrink-0 text-bear" /> Stale prices are rejected, and the vault never spends beyond your budget or your reserve.</p>
        </div>
        <div className="vault relative rounded-[36px] p-[1px]">
          <div className="relative overflow-hidden rounded-[35px] bg-[#070b16]/80 p-6 backdrop-blur-xl sm:p-8">
            <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-bull/70" />
            <div className="relative mb-5 flex items-center justify-between">
              <span className="font-mono text-[12px] tracking-[0.2em] text-bull">PROTECTIONVAULT · POLICY</span>
              <span className="rounded-full border border-bull/30 bg-bull/10 px-2.5 py-0.5 text-[11px] font-semibold text-bull">Active</span>
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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_40%,rgb(34_227_154/0.14),transparent_70%)]" />
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
  return <div className="mb-4 font-mono text-[12px] uppercase tracking-[0.2em] text-bull/90">{children}</div>;
}
