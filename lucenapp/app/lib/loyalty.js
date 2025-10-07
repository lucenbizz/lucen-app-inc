// /lib/loyalty.js  (helpers used by Checkout UI)
export const MULTIPLIERS = { bronze: 1.0, silver: 1.25, gold: 1.5, black: 2.0 };
export const REDEEM_STEP = 1000;                 // points
export const REDEEM_VALUE_PER_STEP_CENTS = 500;  // $5 per 1000 pts

export function pointsFor(amountCents, tier = 'bronze') {
  const dollars = Number(amountCents || 0) / 100;
  const m = MULTIPLIERS[String(tier || 'bronze').toLowerCase()] ?? 1.0;
  return Math.floor(dollars * 5 * m);
}

export function valueForPoints(points) {
  const p = Math.max(0, Number(points || 0));
  const steps = Math.floor(p / REDEEM_STEP);
  return steps * REDEEM_VALUE_PER_STEP_CENTS;
}

export function maxRedeemablePoints(balance, priceCents) {
  const byBalance = Math.floor(Math.max(0, Number(balance || 0)) / REDEEM_STEP) * REDEEM_STEP;
  const byPrice   = Math.floor(Math.max(0, Number(priceCents || 0)) / REDEEM_VALUE_PER_STEP_CENTS) * REDEEM_STEP;
  return Math.max(0, Math.min(byBalance, byPrice));
}

export function prettyPoints(n) {
  return Number(n || 0).toLocaleString();
}
