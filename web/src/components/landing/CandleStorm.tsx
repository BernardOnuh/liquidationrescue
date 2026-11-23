"use client";
// The hero story as a trading chart. A choppy market, then red candles strike down like lightning toward liquidation;
// a cyan shield snaps into place at the rescue threshold, the fall breaks on it, and green candles climb back as the
// position's health factor is restored. One 12-second loop on a 2D canvas. Pauses off screen; reduced motion draws the
// protected end state once. The chart is the position's health (HF), which is what a rescue restores.
import { useEffect, useRef } from "react";

export type StormPhase = "calm" | "crash" | "shield" | "rally";

interface Candle { o: number; c: number; h: number; l: number; t0: number; dur: number; kind: "chop" | "crash" | "hit" | "rally" }

const LIQ = 0.12, SHIELD = 0.24, TARGET = 0.37; // positions on the 0..1 chart (bottom..top): HF 1.00, 1.24, 1.50
const hfAt = (p: number) => 0.76 + 2 * p; // LIQ → 1.00, SHIELD → 1.24
const CYCLE = 10;

// A deterministic script of candles for one cycle (seeded, so every loop looks the same).
function script(): Candle[] {
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out: Candle[] = []; let t = 0, p = 0.56;
  const push = (o: number, c: number, kind: Candle["kind"], dur: number, wick = 0.025) => {
    out.push({ o, c, h: Math.max(o, c) + rnd() * wick, l: Math.min(o, c) - rnd() * wick, t0: t, dur, kind }); t += dur;
  };
  for (let i = 0; i < 16; i++) { const c = p + (rnd() - 0.47) * 0.06; push(p, c, "chop", 0.16); p = c; }       // 0 – 2.6 s
  for (const d of [0.05, 0.08, 0.06, 0.1, 0.07]) { const c = p - d; push(p, c, "crash", 0.3, 0.03); p = c; }   // 2.6 – 4.1 s
  // The rescue: the repayment lifts the health factor straight to the target, from a wick that touches the shield.
  const hit = { o: p, c: TARGET, h: TARGET + 0.012, l: SHIELD, t0: t, dur: 0.45, kind: "hit" as const }; out.push(hit); t += 0.45; p = hit.c;
  // Then the recovery.
  for (let i = 0; i < 12; i++) { const c = p + 0.022 + rnd() * 0.03 - (i % 4 === 3 ? 0.035 : 0); push(p, c, "rally", 0.22, 0.02); p = c; }
  return out;
}

export function CandleStorm({ className, onPhase, mode = "hero" }: { className?: string; onPhase?: (p: StormPhase) => void; mode?: "hero" | "calm" }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvas.current!; const ctx = cv.getContext("2d")!;
    const candles = script();
    const crashStart = candles.find(c => c.kind === "crash")!.t0, hitC = candles.find(c => c.kind === "hit")!, rallyStart = candles.find(c => c.kind === "rally")!.t0;
    const crashCandles = candles.filter(c => c.kind === "crash");
    let W = 0, H = 0, dpr = 1, raf = 0, visible = true, phase: StormPhase | null = null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sparks: { x: number; y: number; vx: number; vy: number; life: number; hue: string }[] = [];
    const rising: { x: number; y: number; v: number; life: number }[] = [];
    let sparked = -1, lastT = 0;
    const bolts = crashCandles.map((c, i) => ({ at: c.t0 + 0.02, idx: candles.indexOf(c), seed: i * 97 + 13 }));

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2); const r = cv.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !reduced) loop(performance.now()); }, { rootMargin: "100px" });
    io.observe(cv);

    const draw = (tAbs: number) => {
      const t = mode === "calm" || reduced ? 10.5 : tAbs % CYCLE;
      const dt = Math.min(0.05, Math.max(0, tAbs - lastT)); lastT = tAbs;
      const top = H * 0.12, bottom = H * 0.9, Y = (p: number) => bottom - p * (bottom - top);
      const narrow = W < 640, spacing = narrow ? 15 : 27, bw = narrow ? 8 : 15;
      const nowX = W * (narrow ? 0.74 : 0.7);
      const visibleIdx = candles.findIndex(c => t < c.t0 + c.dur); const cur = visibleIdx === -1 ? candles.length - 1 : visibleIdx;
      const kc = Math.min(1, Math.max(0, (t - candles[cur].t0) / candles[cur].dur));
      const xOf = (i: number) => nowX - (cur - i + kc) * spacing; // the chart glides left as each candle forms
      const crashing = t >= crashStart && t < hitC.t0 + hitC.dur, rally = t >= rallyStart;
      const shieldK = mode === "calm" ? 1 : Math.min(1, Math.max(0, (t - (hitC.t0 - 0.55)) / 0.4));
      const shake = crashing && !reduced ? (1 - (t - crashStart) / (hitC.t0 + hitC.dur - crashStart)) * 5 + 2 : 0;

      ctx.save();
      ctx.clearRect(0, 0, W, H);
      // fade between loops instead of cutting
      if (mode === "hero" && !reduced) ctx.globalAlpha = Math.min(1, t / 0.5, (CYCLE - t) / 0.6);
      if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

      // atmosphere: red during the crash, green on the way back up
      const danger = crashing ? Math.min(1, (t - crashStart) / 1) : 0;
      const relief = rally ? Math.min(1, (t - rallyStart) / 1.2) * (mode === "calm" ? 0.6 : 1) : 0;
      if (danger) { const g = ctx.createRadialGradient(nowX, Y(SHIELD), 10, nowX, Y(SHIELD), W * 0.7); g.addColorStop(0, `rgba(255,50,40,${0.22 * danger})`); g.addColorStop(1, "rgba(255,50,40,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      if (relief) { const g = ctx.createRadialGradient(nowX, Y(0.6), 10, nowX, Y(0.6), W * 0.7); g.addColorStop(0, `rgba(16,220,140,${0.16 * relief})`); g.addColorStop(1, "rgba(16,220,140,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
      for (let gy = 0; gy <= 8; gy++) { const y = top + (gy / 8) * (bottom - top); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // liquidation line
      ctx.setLineDash([6, 6]); ctx.strokeStyle = "rgba(255,59,59,0.6)"; ctx.beginPath(); ctx.moveTo(0, Y(LIQ)); ctx.lineTo(W, Y(LIQ)); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "600 11px 'JetBrains Mono', monospace"; ctx.fillStyle = "rgba(255,90,90,0.95)"; ctx.textAlign = "right";
      ctx.fillText("LIQUIDATION · HF 1.00", W - 14, Y(LIQ) + 16);

      // candles
      for (let i = 0; i <= cur; i++) {
        const c = candles[i]; const k = i === cur ? Math.min(1, (t - c.t0) / c.dur) : 1; if (k <= 0 && i === cur) continue;
        const x = xOf(i);
        if (x < -20) continue;
        const close = c.o + (c.c - c.o) * (c.kind === "crash" ? Math.pow(k, 0.35) : k);
        const up = close >= c.o, green = up || c.kind === "rally";
        const col = c.kind === "crash" ? "#ff3b3b" : green ? (c.kind === "rally" || c.kind === "hit" ? "#22e39a" : "rgba(34,227,154,0.55)") : "rgba(255,90,90,0.55)";
        const hi = c.o + (c.h - c.o) * k > close ? Math.max(c.o, close) + (c.h - Math.max(c.o, c.c)) * k : Math.max(c.o, close);
        const lo = c.kind === "hit" ? Math.min(c.o, close) - (Math.min(c.o, c.c) - c.l) * Math.min(1, k * 2) : Math.min(c.o, close) - (Math.min(c.o, c.c) - c.l) * k;
        ctx.save();
        if (c.kind === "crash" || c.kind === "rally" || c.kind === "hit") { ctx.shadowColor = col; ctx.shadowBlur = c.kind === "crash" ? 22 : 16; }
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, Y(hi)); ctx.lineTo(x, Y(lo)); ctx.stroke();
        ctx.fillStyle = col; const yTop = Y(Math.max(c.o, close)), yBot = Y(Math.min(c.o, close));
        ctx.fillRect(x - bw / 2, yTop, bw, Math.max(2, yBot - yTop));
        ctx.restore();
      }

      // lightning: one strike per crash candle
      if (!reduced && mode === "hero") for (const b of bolts) {
        const age = t - b.at; if (age < 0 || age > 0.28) continue;
        const ci = b.idx; if (ci > cur) continue; const x0 = xOf(ci);
        const tgt = candles[ci]; const yEnd = Y(Math.min(tgt.o, tgt.c) - 0.02);
        const a = 1 - age / 0.28; let r = b.seed; const rr = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
        const pts: [number, number][] = [[x0 + (rr() - 0.5) * 120, 0]];
        const steps = 9; for (let j = 1; j <= steps; j++) pts.push([x0 + (rr() - 0.5) * 60 * (1 - j / steps) + (j === steps ? 0 : 0), (yEnd * j) / steps]);
        for (const [w, colr, blur] of [[7, `rgba(255,60,40,${0.35 * a})`, 30], [2.4, `rgba(255,220,210,${0.95 * a})`, 12]] as const) {
          ctx.save(); ctx.strokeStyle = colr; ctx.lineWidth = w; ctx.shadowColor = "#ff3b2f"; ctx.shadowBlur = blur; ctx.lineJoin = "miter";
          ctx.beginPath(); pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); ctx.restore();
        }
        ctx.fillStyle = `rgba(255,80,60,${0.12 * a})`; ctx.fillRect(0, 0, W, H); // flash
      }

      // the shield
      if (shieldK > 0) {
        const ys = Y(SHIELD), half = Math.min(W * 0.42, 380) * shieldK, cx = xOf(candles.indexOf(hitC));
        const impact = Math.max(0, 1 - Math.abs(t - (hitC.t0 + 0.12)) / 0.5);
        ctx.save();
        // fade the shield's ends so it never runs hard into the page
        const edge = ctx.createLinearGradient(cx - half, 0, cx + half, 0); edge.addColorStop(0, "rgba(170,255,214,0)"); edge.addColorStop(0.18, "rgba(170,255,214,0.95)"); edge.addColorStop(0.82, "rgba(170,255,214,0.95)"); edge.addColorStop(1, "rgba(170,255,214,0)");
        const grd = ctx.createLinearGradient(0, ys - 40, 0, ys + 30); grd.addColorStop(0, "rgba(34,227,154,0)"); grd.addColorStop(0.75, `rgba(34,227,154,${0.12 + 0.2 * impact})`); grd.addColorStop(1, "rgba(34,227,154,0)");
        ctx.fillStyle = grd; ctx.fillRect(cx - half, ys - 40, half * 2, 70);
        ctx.shadowColor = "#22e39a"; ctx.shadowBlur = 24 + 30 * impact; ctx.strokeStyle = edge; ctx.lineWidth = 2.5 + 2 * impact;
        ctx.beginPath();
        for (let x = cx - half; x <= cx + half; x += 6) { const w = Math.sin(x * 0.045 + tAbs * 6) * (1.5 + 7 * impact * Math.exp(-Math.abs(x - cx) / 90)); x === cx - half ? ctx.moveTo(x, ys + w) : ctx.lineTo(x, ys + w); }
        ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = "rgba(34,227,154,0.35)"; ctx.shadowBlur = 0;
        for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(cx - half, ys + k * 6); ctx.lineTo(cx + half, ys + k * 6); ctx.globalAlpha = 0.5 / k; ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.restore();
        ctx.font = "600 11px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.fillStyle = `rgba(170,255,214,${shieldK})`;
        ctx.textAlign = "right"; ctx.fillText("RESCUE THRESHOLD · HF 1.24", Math.min(W - 14, cx + half), ys + 22);
        const tk = mode === "calm" ? 1 : Math.min(1, Math.max(0, (t - (hitC.t0 + 0.3)) / 0.5));
        if (tk > 0) {
          ctx.setLineDash([3, 5]); ctx.strokeStyle = `rgba(52,240,170,${0.45 * tk})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - half, Y(TARGET)); ctx.lineTo(cx + half, Y(TARGET)); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = `rgba(110,245,190,${0.9 * tk})`; ctx.fillText("RESCUE TARGET · HF 1.50", Math.min(W - 14, cx + half), Y(TARGET) - 8);
        }
      }

      // sparks where the fall breaks on the shield
      if (mode === "hero" && !reduced && t >= hitC.t0 + 0.08 && sparked !== Math.floor(tAbs / CYCLE)) {
        sparked = Math.floor(tAbs / CYCLE);
        const hx = xOf(candles.indexOf(hitC));
        for (let i = 0; i < 90; i++) { const a = Math.PI + Math.random() * Math.PI, v = 80 + Math.random() * 380; sparks.push({ x: hx, y: Y(SHIELD), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8, life: 0.6 + Math.random() * 0.6, hue: Math.random() < 0.5 ? "255,90,60" : "170,255,214" }); }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.life -= dt; if (s.life <= 0) { sparks.splice(i, 1); continue; }
        s.vy += 420 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        ctx.fillStyle = `rgba(${s.hue},${Math.min(1, s.life)})`; ctx.fillRect(s.x, s.y, 2.2, 2.2);
      }

      // green energy rising during the rally
      if (rally && !reduced && mode === "hero" && Math.random() < 0.6) rising.push({ x: nowX - Math.random() * 260, y: Y(SHIELD) - 4, v: 60 + Math.random() * 120, life: 1.4 });
      for (let i = rising.length - 1; i >= 0; i--) {
        const r = rising[i]; r.life -= dt; if (r.life <= 0) { rising.splice(i, 1); continue; }
        r.y -= r.v * dt; ctx.fillStyle = `rgba(52,240,170,${0.5 * r.life})`; ctx.fillRect(r.x, r.y, 2, 6);
      }

      // health factor readout, following the latest candle
      const c = candles[cur]; const k = Math.min(1, Math.max(0, (t - c.t0) / c.dur)); const p = c.o + (c.c - c.o) * k;
      const hf = hfAt(p); const tone = hf < 1.24 || crashing ? "#ff3b3b" : rally ? "#22e39a" : "#ffffff";
      ctx.textAlign = "left"; ctx.font = "500 11px 'JetBrains Mono', monospace"; ctx.fillStyle = "rgba(203,213,225,0.7)";
      const lx = Math.min(W - 150, xOf(cur) + 18); ctx.fillText("HEALTH FACTOR", lx, Y(p) - 18);
      ctx.font = "600 22px 'JetBrains Mono', monospace"; ctx.fillStyle = tone; ctx.fillText(hf.toFixed(2), lx, Y(p) + 4);
      ctx.restore();

      const next: StormPhase = mode === "calm" ? "rally" : t < crashStart ? "calm" : t < hitC.t0 - 0.4 ? "crash" : t < rallyStart + 0.4 ? "shield" : "rally";
      if (next !== phase) { phase = next; onPhase?.(next); }
    };
    const loop = (now: number) => { if (!visible) return; draw(now / 1000); raf = requestAnimationFrame(loop); };
    if (reduced) draw(10.5); else raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [mode, onPhase]);
  // soft edges, so glows never end in a hard rectangle
  return <canvas ref={canvas} className={className} aria-hidden style={{ maskImage: "radial-gradient(115% 95% at 60% 50%, #000 55%, transparent 88%)", WebkitMaskImage: "radial-gradient(115% 95% at 60% 50%, #000 55%, transparent 88%)" }} />;
}
