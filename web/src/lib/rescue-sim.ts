// The rescue decision from ProtectionVault.sol, in plain numbers, for the homepage simulator. Same order of checks and
// the same repayment formula as `_rescue` and `_repayToReach`; liquidation as in MockLendingMarket (HF < 1).
// Nothing here sends a transaction.

export const LT = 0.8; // MockLendingMarket.LIQUIDATION_THRESHOLD_BPS = 8000

export type Outcome = "Rescued" | "PartiallyRescued" | "NotNeeded" | "BudgetExhausted" | "NoReserve" | "AlreadyLiquidated";

export interface SimPolicy { triggerHF: number; targetHF: number; maxSpend: number }
export interface SimPosition { collateral: number; debt: number }

export const healthFactor = (p: SimPosition, price: number) => (p.debt <= 0 ? Infinity : (p.collateral * price * LT) / p.debt);

/** `_repayToReach`: the smallest repayment x with adjustedCollateral / (debt − x) ≥ target. */
export const repayToReach = (p: SimPosition, price: number, targetHF: number) =>
  Math.max(0, p.debt - (p.collateral * price * LT) / targetHF);

export interface RescueResult { outcome: Outcome; amount: number; hfBefore: number; hfAfter: number; position: SimPosition; spent: number; reserve: number }

/** One risk event at `price`: what the vault would do. `spent` and `reserve` are the policy's state before the event. */
export function evaluate(pos: SimPosition, price: number, policy: SimPolicy, spent: number, reserve: number): RescueResult {
  const hfBefore = healthFactor(pos, price);
  const base = { amount: 0, hfBefore, hfAfter: hfBefore, position: pos, spent, reserve };
  if (pos.debt <= 0) return { ...base, outcome: "AlreadyLiquidated" };
  if (hfBefore >= policy.triggerHF) return { ...base, outcome: "NotNeeded" };
  if (spent >= policy.maxSpend) return { ...base, outcome: "BudgetExhausted" };
  if (reserve <= 0) return { ...base, outcome: "NoReserve" };
  const amount = Math.min(repayToReach(pos, price, policy.targetHF), policy.maxSpend - spent, reserve, pos.debt);
  const position = { ...pos, debt: pos.debt - amount };
  const hfAfter = healthFactor(position, price);
  return { outcome: hfAfter >= policy.targetHF - 1e-9 ? "Rescued" : "PartiallyRescued", amount, hfBefore, hfAfter, position, spent: spent + amount, reserve: reserve - amount };
}

/** The price at which a position's health factor equals `hf`. */
export const priceAtHF = (p: SimPosition, hf: number) => (p.collateral > 0 ? (hf * p.debt) / (p.collateral * LT) : 0);
