import { formatUnits } from "viem";

export const HF_ONE = 10n ** 18n;
export const MAX = 2n ** 256n - 1n;
export const fmtHF = (hf: bigint | undefined) => hf === undefined ? "–" : hf === MAX ? "∞" : (Number(hf / 10n ** 14n) / 1e4).toFixed(2);
export const hfNum = (hf: bigint) => hf === MAX ? Infinity : Number(hf / 10n ** 14n) / 1e4;
export const fmtUsd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export const usdc = (v: bigint) => Number(formatUnits(v, 6));
export const fmtUsdc = (v: bigint) => fmtUsd(usdc(v));
export const price8 = (v: bigint) => Number(formatUnits(v, 8));
export const short = (h: string, n = 6) => `${h.slice(0, n)}…${h.slice(-4)}`;
export const hfTone = (hf: number, trigger?: number) =>
  hf < 1.0 ? "danger" : trigger !== undefined && hf < trigger ? "warn" : hf < 1.25 ? "warn" : "ok";
export const ago = (sec: number) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - sec));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
};
