"use client";
import { Fragment, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { formatEther, parseEther, parseUnits, type Address, type Hex } from "viem";
import { Activity, ArrowRight, Clock, Gauge, Layers, LifeBuoy, Loader2, Pause, Play, Radio, ShieldCheck, TrendingDown, Trash2, Zap } from "lucide-react";
import { MockERC20Abi, MockLendingMarketAbi, MockPriceOracleAbi, ProtectionVaultAbi } from "@/lib/abi";
import { dep, deployed, isLocal } from "@/lib/config";
import { useAccountState, useMarket, usePriceHistory, useRescueLog, type RescueRow } from "@/lib/data";
import { HF_ONE, ago, fmtHF, fmtUsd, fmtUsdc, hfNum, price8, short, usdc } from "@/lib/format";
import { Badge, Panel, Stat, TxLink, TxStatus } from "./ui";
import { WalletButton, useTxRunner } from "./wallet";
import { Mark } from "./brand";
import Link from "next/link";

const LT = 0.8; // the mock market's liquidation threshold

export function Dashboard() {
  const { address } = useAccount();
  return (
    <div className="glow-bg min-h-screen">
      <Header />
      {dep.simulated && (
        <div className="mx-auto mt-3 max-w-7xl px-4 sm:px-6"><div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-center text-[12px] font-medium text-[#c3cad6]">
          Local simulation · Reactive Network is played by a local relayer and test tokens have no value. Real cross-chain proof comes from the testnet deployment.
        </div></div>
      )}
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6">
        <Hero />
        {!deployed ? <NotDeployed /> : (
          <>
            <FlowStrip />
            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <PositionPanel user={address} />
                <PolicyPanel user={address} />
              </div>
              <div className="space-y-5">
                <PricePanel user={address} />
                <WatchPanel />
              </div>
            </div>
            <RescueLog user={address} />
          </>
        )}
      </main>
      <footer className="border-t border-edge px-4 py-6 text-center text-[12px] text-dim">
        Testnet only · not audited · a rescue is best effort and can&apos;t help a position that is already liquidated.
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 px-3 pt-3 sm:px-5">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-full border border-white/10 bg-[#05070c]/85 py-2 pl-3 pr-2 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.9)] backdrop-blur-xl sm:pl-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="font-display text-[17px] font-bold tracking-[-0.02em] text-white">Liquidation<span className="text-ok">Rescue</span></span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/" className="hidden rounded-full px-3 py-2 text-[13px] font-medium text-[#c3cad6] transition hover:text-white sm:block">Home</Link>
          <span className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-mono text-[11px] tracking-[0.06em] text-[#c3cad6] md:flex">
            <span className="live-dot" />{dep.origin.name}{!isLocal && <> <ArrowRight className="h-3 w-3" /> {dep.reactive.name}</>}
          </span>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <div className="mb-7 max-w-3xl">
      <Badge tone="rescue"><Zap className="h-3 w-3" />Event-triggered on Reactive Network</Badge>
      <h1 className="mt-4 font-display text-[34px] font-bold leading-[1.02] tracking-[-0.03em] text-white sm:text-[52px]">Rescue before liquidation, <span className="text-ok">within your limits.</span></h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#c3cad6]">
        Set a trigger, a target and a budget, and fund your own reserve. When the collateral price drops, Reactive Network calls the vault, which rechecks your position and repays just enough debt to reach your target. Never more than your budget, never after expiry, and every decision is recorded.
      </p>
    </div>
  );
}

function NotDeployed() {
  return (
    <div className="panel border-dashed text-[14px] text-dim">
      <p className="font-semibold text-text">Not deployed on {dep.origin.name} yet.</p>
      <p className="mt-2">Run the four deploy steps in the README (origin, reactive, vault, link). They write the addresses this dashboard reads.</p>
    </div>
  );
}

/** The three hops of the most recent rescue: price event → Reactive → callback. */
function FlowStrip() {
  const { data } = useRescueLog();
  const last = data?.rows[0];
  const pending = data?.pending[0];
  const nodes = [
    { icon: <TrendingDown className="h-4 w-4" />, chain: dep.origin.name, title: "Price drops", body: "The feed emits PriceUpdated", side: "origin" as const, hash: (last?.originTx ?? pending?.originTx) as Hex | undefined, tone: "#ff3b3b" },
    { icon: <Radio className="h-4 w-4" />, chain: dep.simulated ? "Reactive (simulated)" : dep.reactive.name, title: "react() requests a callback", body: "One per protected user", side: "reactive" as const, hash: (last?.reactiveTx ?? pending?.reactiveTx) as Hex | undefined, tone: "#e8ecf5" },
    { icon: <LifeBuoy className="h-4 w-4" />, chain: dep.origin.name, title: "Vault decides and repays", body: last ? last.outcome : "Rechecks HF, budget, price age", side: "origin" as const, hash: pending ? undefined : last?.callbackTx, tone: "#22e39a" },
  ];
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#05070c]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
        <span className="flex items-center gap-2.5 font-mono text-[11.5px] tracking-[0.14em] text-[#c3cad6]"><span className="live-dot" />LATEST RESCUE · ACROSS CHAINS</span>
        {pending && <Badge tone="reactive"><Loader2 className="h-3 w-3 animate-spin" />Callback in flight</Badge>}
      </div>
      <ol className="grid gap-3 p-4 sm:p-5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-0">
        {nodes.map((n, i) => (
          <Fragment key={i}>
            <li className="rounded-2xl border p-4" style={{ borderColor: `${n.tone}40`, background: `${n.tone}0a` }}>
              <div className="flex items-center justify-between font-mono text-[11px] font-semibold tracking-[0.14em]" style={{ color: n.tone }}><span>{n.chain.toUpperCase()}</span>{n.icon}</div>
              <div className="mt-2 font-display text-[17px] font-bold text-white">{n.title}</div>
              <div className="mt-0.5 text-[12px] text-dim">{n.body}</div>
              <div className="mt-3 border-t border-white/[0.07] pt-3"><TxLink side={n.side} hash={n.hash} /></div>
            </li>
            {i < 2 && <div className="flex items-center justify-center md:w-12"><span className="h-6 w-px md:h-px md:w-full" style={{ background: `linear-gradient(90deg, ${n.tone}, ${nodes[i + 1].tone})` }} /></div>}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}

function HFGauge({ hf, trigger, target }: { hf: number; trigger?: number; target?: number }) {
  const lo = 0.8, hi = 2.5;
  const pct = (x: number) => `${((Math.min(Math.max(x, lo), hi) - lo) / (hi - lo)) * 100}%`;
  const tone = hf < 1 ? "bg-danger" : trigger && hf < trigger ? "bg-warn" : "bg-ok";
  return (
    <div className="pt-6">
      <div className="relative h-3 rounded-full bg-gradient-to-r from-danger/50 via-warn/40 to-ok/40">
        <Marker at={pct(1)} label="1.00 liquidation" tone="text-danger" below />
        {trigger && <Marker at={pct(trigger)} label={`${trigger.toFixed(2)} trigger`} tone="text-warn" />}
        {target && <Marker at={pct(target)} label={`${target.toFixed(2)} target`} tone="text-ok" below />}
        {Number.isFinite(hf) && <span className={`absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-bg ${tone} shadow-lg`} style={{ left: pct(hf) }} />}
      </div>
      <div className="h-6" />
    </div>
  );
}
function Marker({ at, label, tone, below }: { at: string; label: string; tone: string; below?: boolean }) {
  return (
    <span className="absolute top-0 h-3 w-px bg-white/50" style={{ left: at }}>
      <span className={`absolute ${below ? "top-5" : "-top-5"} -translate-x-1/2 whitespace-nowrap text-[10px] font-bold ${tone}`}>{label}</span>
    </span>
  );
}

function PositionPanel({ user }: { user?: Address }) {
  const { data: m } = useMarket();
  const { data: a } = useAccountState(user);
  const { writeContractAsync } = useWriteContract();
  const tx = useTxRunner();
  const [coll, setColl] = useState("1");
  const [borrow, setBorrow] = useState("1200");

  if (!user) return <Panel title="Your position" icon={<Gauge className="h-4 w-4 text-rescue" />}><p className="text-[14px] text-dim">Connect a wallet to open a test position and protect it.{isLocal && " On the local chain, pick a local test account."}</p></Panel>;
  if (!a || !m) return <Panel title="Your position" icon={<Gauge className="h-4 w-4 text-rescue" />}><Loader2 className="h-5 w-5 animate-spin text-dim" /></Panel>;

  const collateral = Number(formatEther(a.collateral));
  const debt = usdc(a.debt);
  const price = price8(m.price);
  const hf = hfNum(a.hf);
  const policy = a.policy.active ? a.policy : undefined;
  const trigger = policy ? hfNum(policy.triggerHF) : undefined;
  const target = policy ? hfNum(policy.targetHF) : undefined;

  async function open() {
    const c = parseEther(coll || "0"), b = parseUnits(borrow || "0", 6);
    const steps = [];
    if (a!.weth < c) steps.push({ label: "Mint test WETH", send: () => writeContractAsync({ address: dep.weth!, abi: MockERC20Abi, functionName: "mint", args: [user!, c - a!.weth] }) });
    if (a!.wethAllowance < c) steps.push({ label: "Approve WETH", send: () => writeContractAsync({ address: dep.weth!, abi: MockERC20Abi, functionName: "approve", args: [dep.market!, c] }) });
    if (c > 0n) steps.push({ label: "Deposit collateral", send: () => writeContractAsync({ address: dep.market!, abi: MockLendingMarketAbi, functionName: "depositCollateral", args: [c] }) });
    if (b > 0n) steps.push({ label: "Borrow USDC", send: () => writeContractAsync({ address: dep.market!, abi: MockLendingMarketAbi, functionName: "borrow", args: [b] }) });
    await tx.run(steps);
  }

  const hasPosition = a.debt > 0n;
  return (
    <Panel title="Your position" icon={<Gauge className="h-4 w-4 text-rescue" />} right={<Badge tone="dim">Mock lending market</Badge>}>
      {hasPosition ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Health factor" value={fmtHF(a.hf)} tone={hf < 1 ? "danger" : trigger && hf < trigger ? "warn" : "ok"} sub={a.hf < HF_ONE ? "Liquidatable" : trigger && hf < trigger ? "Below your trigger" : "Healthy"} />
            <Stat label="Collateral" value={`${collateral.toFixed(3)} WETH`} sub={fmtUsd(collateral * price)} />
            <Stat label="Debt" value={fmtUsdc(a.debt)} sub="USDC" />
            <Stat label="Liquidation price" value={fmtUsd(debt / (collateral * LT))} sub="per WETH" />
          </div>
          <HFGauge hf={hf} trigger={trigger} target={target} />
        </>
      ) : (
        <div>
          <p className="mb-4 text-[14px] text-dim">Open a test position: deposit WETH as collateral and borrow test USDC against it (80% liquidation threshold, WETH at {fmtUsd(price)}).</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label><span className="label">Collateral (WETH)</span><input className="input" value={coll} onChange={e => setColl(e.target.value)} inputMode="decimal" /></label>
            <label><span className="label">Borrow (USDC)</span><input className="input" value={borrow} onChange={e => setBorrow(e.target.value)} inputMode="decimal" /></label>
            <button className="btn-primary" disabled={tx.busy} onClick={open}>Open position</button>
          </div>
          {Number(coll) > 0 && <p className="mt-3 text-[12px] text-dim">Starting health factor ≈ {((Number(coll) * price * LT) / Math.max(Number(borrow), 1e-9)).toFixed(2)}</p>}
        </div>
      )}
      <TxStatus state={tx.state} />
    </Panel>
  );
}

function PolicyPanel({ user }: { user?: Address }) {
  const { data: m } = useMarket();
  const { data: a } = useAccountState(user);
  const { writeContractAsync } = useWriteContract();
  const tx = useTxRunner();
  const [trigger, setTrigger] = useState("1.25");
  const [target, setTarget] = useState("1.5");
  const [maxSpend, setMaxSpend] = useState("300");
  const [days, setDays] = useState("7");
  const [amount, setAmount] = useState("300");
  const [editing, setEditing] = useState(false);
  if (!user || !a || !m) return null;

  const p = a.policy;
  const active = p.active;
  const collateral = Number(formatEther(a.collateral));
  const debt = usdc(a.debt);
  const price = price8(m.price);
  const t = active && !editing ? hfNum(p.triggerHF) : Number(trigger);
  const g = active && !editing ? hfNum(p.targetHF) : Number(target);
  const budgetLeft = active && !editing ? usdc(p.maxSpend - p.spent) : Number(maxSpend) - (active ? usdc(p.spent) : 0);
  const triggerPrice = collateral > 0 ? (t * debt) / (collateral * LT) : 0;
  const repayAtTrigger = Math.max(0, debt - (collateral * triggerPrice * LT) / g);
  const wouldSpend = Math.min(repayAtTrigger, budgetLeft, usdc(a.reserve));
  const hf2 = (v: string) => parseUnits(v || "0", 18);

  const configure = () => tx.run([{ label: "Save policy", send: () => writeContractAsync({ address: dep.vault!, abi: ProtectionVaultAbi, functionName: "configurePolicy", args: [hf2(trigger), hf2(target), parseUnits(maxSpend || "0", 6), BigInt(Math.floor(Date.now() / 1000) + Math.round(Number(days) * 86400))] }) }]).then(ok => ok && setEditing(false));
  const fund = () => {
    const v = parseUnits(amount || "0", 6);
    const steps = [];
    if (a.usdc < v) steps.push({ label: "Mint test USDC", send: () => writeContractAsync({ address: dep.usdc!, abi: MockERC20Abi, functionName: "mint", args: [user, v - a.usdc] }) });
    if (a.usdcAllowance < v) steps.push({ label: "Approve USDC", send: () => writeContractAsync({ address: dep.usdc!, abi: MockERC20Abi, functionName: "approve", args: [dep.vault!, v] }) });
    steps.push({ label: "Fund reserve", send: () => writeContractAsync({ address: dep.vault!, abi: ProtectionVaultAbi, functionName: "fundReserve", args: [v] }) });
    return tx.run(steps);
  };
  const withdraw = () => tx.run([{ label: "Withdraw unused reserve", send: () => writeContractAsync({ address: dep.vault!, abi: ProtectionVaultAbi, functionName: "withdrawUnused", args: [parseUnits(amount || "0", 6)] }) }]);
  const setPaused = (paused: boolean) => tx.run([{ label: paused ? "Pause policy" : "Resume policy", send: () => writeContractAsync({ address: dep.vault!, abi: ProtectionVaultAbi, functionName: "setPaused", args: [paused] }) }]);
  const revoke = () => tx.run([{ label: "Revoke policy", send: () => writeContractAsync({ address: dep.vault!, abi: ProtectionVaultAbi, functionName: "revokePolicy" }) }]);

  const expired = active && Number(p.expiry) < Date.now() / 1000;
  const status = !active ? <Badge>No policy</Badge> : expired ? <Badge tone="danger">Expired</Badge> : p.paused ? <Badge tone="warn">Paused</Badge> : <Badge tone="ok"><ShieldCheck className="h-3 w-3" />Protected</Badge>;
  const spentPct = active && p.maxSpend > 0n ? Number((p.spent * 10000n) / p.maxSpend) / 100 : 0;

  return (
    <Panel title="Rescue policy & reserve" icon={<ShieldCheck className="h-4 w-4 text-rescue" />} right={status}>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          {active && !editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Trigger below" value={fmtHF(p.triggerHF)} tone="warn" />
                <Stat label="Restore to" value={fmtHF(p.targetHF)} tone="ok" />
              </div>
              <div>
                <div className="flex justify-between text-[12px]"><span className="text-dim">Budget used</span><span className="font-mono">{fmtUsdc(p.spent)} / {fmtUsdc(p.maxSpend)}</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-rescue" style={{ width: `${spentPct}%` }} /></div>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-dim"><Clock className="h-3.5 w-3.5" />{expired ? "Expired" : "Expires"} {new Date(Number(p.expiry) * 1000).toLocaleString()}</div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost" disabled={tx.busy} onClick={() => setEditing(true)}>Edit</button>
                <button className="btn-ghost" disabled={tx.busy} onClick={() => setPaused(!p.paused)}>{p.paused ? <><Play className="h-4 w-4" />Resume</> : <><Pause className="h-4 w-4" />Pause</>}</button>
                <button className="btn-danger" disabled={tx.busy} onClick={revoke}><Trash2 className="h-4 w-4" />Revoke</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label><span className="label">Trigger below HF</span><input className="input" value={trigger} onChange={e => setTrigger(e.target.value)} inputMode="decimal" /></label>
                <label><span className="label">Restore to HF</span><input className="input" value={target} onChange={e => setTarget(e.target.value)} inputMode="decimal" /></label>
                <label><span className="label">Max spend (USDC)</span><input className="input" value={maxSpend} onChange={e => setMaxSpend(e.target.value)} inputMode="decimal" /></label>
                <label><span className="label">Valid for (days)</span><input className="input" value={days} onChange={e => setDays(e.target.value)} inputMode="decimal" /></label>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" disabled={tx.busy} onClick={configure}>{active ? "Save changes" : "Activate protection"}</button>
                {editing && <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
              </div>
              {active && <p className="text-[12px] text-dim">Already spent ({fmtUsdc(p.spent)}) still counts against the new cap.</p>}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Reserve" value={fmtUsdc(a.reserve)} sub="yours, withdrawable" />
            <Stat label="Wallet USDC" value={fmtUsdc(a.usdc)} />
          </div>
          <div className="flex gap-2">
            <input className="input" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" aria-label="Amount in USDC" />
            <button className="btn-primary shrink-0" disabled={tx.busy} onClick={fund}>Fund</button>
            <button className="btn-ghost shrink-0" disabled={tx.busy || a.reserve === 0n} onClick={withdraw}>Withdraw</button>
          </div>
          {a.debt > 0n && t > 1 && g > t && (
            <div className="rounded-2xl border border-rescue/25 bg-rescue-soft p-3.5 text-[13px] leading-relaxed">
              <div className="mb-1 font-bold text-rescue">What happens</div>
              If WETH falls below <b className="font-mono">{fmtUsd(triggerPrice)}</b> (now {fmtUsd(price)}), the vault repays about <b className="font-mono">{fmtUsd(repayAtTrigger)}</b> to restore HF {g.toFixed(2)}.
              {wouldSpend <= 0.005 ? <> But your {budgetLeft <= 0.005 ? "budget is used up" : "reserve is empty"}, so nothing would be spent: raise max spend or fund the reserve.</> : wouldSpend < repayAtTrigger - 0.005 && <> Your {budgetLeft <= usdc(a.reserve) ? "remaining budget" : "reserve"} caps it at <b className="font-mono">{fmtUsd(Math.max(0, wouldSpend))}</b>, a partial rescue.</>}
            </div>
          )}
        </div>
      </div>
      <TxStatus state={tx.state} />
    </Panel>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="h-20" />;
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const xy = points.map((p, i) => `${(i / (points.length - 1)) * 100},${36 - ((p - min) / span) * 32 - 2}`);
  const down = points[points.length - 1] < points[0];
  const c = down ? "var(--color-danger)" : "var(--color-ok)";
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-20 w-full">
      <defs><linearGradient id="spark" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={c} stopOpacity="0.35" /><stop offset="1" stopColor={c} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,36 ${xy.join(" ")} 100,36`} fill="url(#spark)" />
      <polyline points={xy.join(" ")} fill="none" stroke={c} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function PricePanel({ user }: { user?: Address }) {
  const { data: m } = useMarket();
  const { data: hist } = usePriceHistory();
  const { writeContractAsync } = useWriteContract();
  const tx = useTxRunner();
  if (!m) return null;
  const price = price8(m.price);
  const isOperator = user && dep.priceOperator && user.toLowerCase() === dep.priceOperator.toLowerCase();
  const move = (pct: number) => {
    const next = (m.price * BigInt(100 + pct)) / 100n;
    return tx.run([{ label: `Publish WETH ${fmtUsd(price8(next))}`, send: () => writeContractAsync({ address: dep.oracle!, abi: MockPriceOracleAbi, functionName: "setPrice", args: [dep.weth!, next] }) }]);
  };
  return (
    <Panel title="WETH price feed" icon={<Activity className="h-4 w-4 text-rescue" />} right={<span className="text-[11px] text-dim">{ago(m.updatedAt)}</span>}>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-extrabold tabular-nums">{fmtUsd(price)}</div>
        {m.reactiveLastPrice > 0n && <div className="text-right text-[11px] text-dim">Reactive last saw<br /><span className="font-mono text-reactive">{fmtUsd(price8(m.reactiveLastPrice))}</span></div>}
      </div>
      <Sparkline points={(hist ?? []).map(h => price8(h.price))} />
      {isOperator ? (
        <div>
          <div className="eyebrow mb-2">Publish a price (test feed operator)</div>
          <div className="grid grid-cols-4 gap-2">
            {[-5, -10, -20, 10].map(p => <button key={p} className={p < 0 ? "btn-ghost !px-2 text-rescue" : "btn-ghost !px-2 text-ok"} disabled={tx.busy} onClick={() => move(p)}>{p > 0 ? "+" : ""}{p}%</button>)}
          </div>
          <TxStatus state={tx.state} />
        </div>
      ) : (
        <p className="text-[12px] text-dim">Prices on this test feed are published by its operator{isLocal ? " (the “Price feed operator” local account)" : ""}. Each update is the event Reactive Network listens for.</p>
      )}
    </Panel>
  );
}

function WatchPanel() {
  const { data: m } = useMarket();
  const { data: log } = useRescueLog();
  const rows = log?.rows ?? [];
  const saved = rows.filter(r => r.outcome === "Rescued" || r.outcome === "Partially rescued");
  const spent = saved.reduce((s, r) => s + r.spent, 0n);
  return (
    <Panel title="Network" icon={<Layers className="h-4 w-4 text-reactive" />}>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Protected users" value={m?.protectedUsers.length ?? "–"} sub="tracked by the reactive contract" />
        <Stat label="Rescues" value={saved.length} sub={`${fmtUsdc(spent)} repaid`} tone="ok" />
        <Stat label="Decisions" value={rows.length} sub="incl. refusals" />
        <Stat label="In flight" value={log?.pending.length ?? 0} sub="awaiting callback" />
      </div>
      <div className="mt-4 space-y-1.5 border-t border-edge pt-4 text-[11px]">
        <Addr label="Vault" chain={dep.origin.name} a={dep.vault!} />
        <Addr label="Reactive contract" chain={dep.simulated ? "simulated" : dep.reactive.name} a={dep.reactiveContract!} />
      </div>
    </Panel>
  );
}
function Addr({ label, chain, a }: { label: string; chain: string; a: string }) {
  return <div className="flex justify-between gap-2"><span className="text-dim">{label} <span className="opacity-60">· {chain}</span></span><span className="mono" title={a}>{short(a)}</span></div>;
}

const OUTCOME_TONE: Record<string, string> = { Rescued: "ok", "Partially rescued": "rescue", "Not needed": "dim", "Already liquidated": "danger", "Repay failed": "danger" };

function RescueLog({ user }: { user?: Address }) {
  const { data } = useRescueLog();
  const [mine, setMine] = useState(false);
  const rows = (data?.rows ?? []).filter(r => !mine || (user && r.user.toLowerCase() === user.toLowerCase()));
  return (
    <Panel className="mt-5" title="Rescue log" icon={<LifeBuoy className="h-4 w-4 text-rescue" />}
      right={user && <div className="flex rounded-xl border border-edge p-0.5 text-[12px]">{["All", "Mine"].map((l, i) => <button key={l} onClick={() => setMine(i === 1)} className={`rounded-lg px-3 py-1 font-semibold ${mine === (i === 1) ? "bg-white/10" : "text-dim"}`}>{l}</button>)}</div>}>
      {(data?.pending ?? []).map(p => (
        <div key={p.eventId} className="mb-2 flex flex-wrap items-center gap-3 rounded-2xl border border-reactive/25 bg-reactive/5 p-3 text-[13px]">
          <Badge tone="reactive"><Loader2 className="h-3 w-3 animate-spin" />Requested</Badge>
          <span className="mono">{short(p.user)}</span><span className="text-dim">at {fmtUsd(price8(p.price))}</span>
          <TxLink side="reactive" hash={p.reactiveTx} label="react" />
        </div>
      ))}
      {rows.length === 0 ? <p className="text-[14px] text-dim">No rescue decisions yet. Protect a position, then let the price drop.</p> : (
        <>
        <ul className="space-y-2 md:hidden">{rows.map(r => <Card key={r.eventId} r={r} you={user} />)}</ul>
        <div className="-mx-2 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead><tr className="eyebrow">{["Outcome", "User", "Price", "Health factor", "Repaid", "Price event", "Reactive", "Callback"].map(h => <th key={h} className="px-2 pb-2 font-bold">{h}</th>)}</tr></thead>
            <tbody>{rows.map(r => <Row key={r.eventId} r={r} you={user} />)}</tbody>
          </table>
        </div>
        </>
      )}
    </Panel>
  );
}
function HFChange({ r }: { r: RescueRow }) {
  return <>{fmtHF(r.hfBefore)}{r.hfAfter !== r.hfBefore && <> <ArrowRight className="inline h-3 w-3 text-dim" /> <span className="text-ok">{fmtHF(r.hfAfter)}</span></>}</>;
}
function Card({ r, you }: { r: RescueRow; you?: Address }) {
  const isYou = you && r.user.toLowerCase() === you.toLowerCase();
  return (
    <li className="rounded-2xl border border-edge bg-bg/50 p-3.5 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={OUTCOME_TONE[r.outcome] ?? "warn"}>{r.outcome}</Badge>
        <span className="mono">{short(r.user)}{isYou && <span className="ml-1.5 font-sans text-[11px] font-bold text-rescue">you</span>}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 font-mono">
        <div><div className="eyebrow !text-[10px]">Price</div>{r.price ? fmtUsd(price8(r.price)) : "–"}</div>
        <div><div className="eyebrow !text-[10px]">HF</div><HFChange r={r} /></div>
        <div><div className="eyebrow !text-[10px]">Repaid</div>{r.spent > 0n ? fmtUsdc(r.spent) : "–"}</div>
      </div>
      <div className="mt-3 space-y-1 border-t border-edge pt-2.5">
        <div className="flex justify-between"><span className="text-dim">1 · Price event</span><TxLink side="origin" hash={r.originTx} /></div>
        <div className="flex justify-between"><span className="text-dim">2 · Reactive</span><TxLink side="reactive" hash={r.reactiveTx} /></div>
        <div className="flex justify-between"><span className="text-dim">3 · Callback</span><TxLink side="origin" hash={r.callbackTx} /></div>
      </div>
    </li>
  );
}
function Row({ r, you }: { r: RescueRow; you?: Address }) {
  const isYou = you && r.user.toLowerCase() === you.toLowerCase();
  return (
    <tr className="border-t border-edge">
      <td className="px-2 py-3"><Badge tone={OUTCOME_TONE[r.outcome] ?? "warn"}>{r.outcome}</Badge></td>
      <td className="px-2 py-3"><span className="mono">{short(r.user)}</span>{isYou && <span className="ml-1.5 text-[11px] font-bold text-rescue">you</span>}</td>
      <td className="px-2 py-3 font-mono">{r.price ? fmtUsd(price8(r.price)) : "–"}</td>
      <td className="px-2 py-3 font-mono"><HFChange r={r} /></td>
      <td className="px-2 py-3 font-mono">{r.spent > 0n ? fmtUsdc(r.spent) : "–"}</td>
      <td className="px-2 py-3"><TxLink side="origin" hash={r.originTx} /></td>
      <td className="px-2 py-3"><TxLink side="reactive" hash={r.reactiveTx} /></td>
      <td className="px-2 py-3"><TxLink side="origin" hash={r.callbackTx} /></td>
    </tr>
  );
}
