// /lib/pricing.js
// Customer prices (EBOOK) and staff delivery commissions (DELIVERY_PAYOUT)
// Updated per your request: Gold $150, Black $500

export const EBOOK_PRICE_CENTS = {
  bronze:  5000,  // $50
  silver:  7500,  // $75
  gold:   15000,  // $150
  black:  50000,  // $500
};

// Fixed staff commission (delivery) by tier
export const DELIVERY_PAYOUT_CENTS = {
  bronze:  700,   // $7
  silver: 1200,   // $12
  gold:   2000,   // $20
  black:  5000,   // $50
};

// Exec revenue share (default 85% = 8500 bps). You can override from DB settings.
export const DEFAULT_EXEC_REVENUE_BPS = 8500; // 85%

export function centsToUSD(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}
