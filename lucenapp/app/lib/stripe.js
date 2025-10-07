// /lib/stripe.js  (NEW)
import Stripe from "stripe";

let stripeSingleton = null;

/**
 * Get a singleton Stripe client.
 * Requires process.env.STRIPE_SECRET_KEY
 */
export function getStripe() {
  if (stripeSingleton) return stripeSingleton;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  stripeSingleton = new Stripe(key, {
    apiVersion: "2024-06-20",
  });
  return stripeSingleton;
}
 