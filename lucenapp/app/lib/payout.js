// /app/lib/payout.js
// Single source of truth for plan pricing, labels, and features

export const TIER_ORDER = ["bronze", "silver", "gold", "black"];

// Prices (in cents) — UPDATED: gold 15000, black 50000
export const TIER_RATES_CENTS = {
  bronze: 5000,
  silver: 7500,
  gold: 15000,
  black: 50000,
};

// Loyalty multipliers (used by pointsFor in ../lib/loyalty)
export const TIER_MULTIPLIER = {
  bronze: 1.0,
  silver: 1.25,
  gold: 1.5,
  black: 2.0,
};

// Display labels + feature bullets — includes 24/7 & 20-min slot language
export const TIER_DISPLAY = {
  bronze: {
    title: "Bronze Ebook",
    features: [
      "Instant ebook access",
      "24/7 delivery windows",
      "Choose 20-minute time slot at checkout",
    ],
  },
  silver: {
    title: "Silver Ebook",
    features: [
      "Instant ebook access",
      "24/7 delivery windows",
      "Choose 20-minute time slot at checkout",
      "Enhanced support",
    ],
  },
  gold: {
    title: "Gold Ebook / Priority Delivery",
    features: [
      "Instant ebook access",
      "Priority delivery",
      "24/7 delivery windows",
      "Choose 20-minute time slot at checkout",
      "Faster support",
    ],
  },
  black: {
    title: "Black Ebook / Priority Delivery / VIP",
    features: [
      "Instant ebook access",
      "Priority delivery + VIP status",
      "24/7 delivery windows",
      "Choose 20-minute time slot at checkout",
      "White-glove support",
    ],
  },
};

// Helpers kept for existing imports
export function centsToUSD(cents) {
  const n = Number(cents || 0) / 100;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function tierTitle(tier) {
  return TIER_DISPLAY[tier]?.title || "";
}
export function tierFeatures(tier) {
  return TIER_DISPLAY[tier]?.features || [];
}
