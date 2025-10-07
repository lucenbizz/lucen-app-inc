// /lib/stripeConnect.js  (NEW)
import { getStripe } from "../lib/stripe";

function getOrigin() {
  return process.env.APP_ORIGIN || "http://localhost:3000";
}

export async function createExpressAccount({ email, name }) {
  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    email: email || undefined,
    business_type: "individual",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: name ? { name } : undefined,
  });
  return account;
}

export async function createOnboardingLink({ accountId }) {
  const stripe = getStripe();
  const origin = getOrigin();
  return stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/admin/users?onboarding=refresh`,
    return_url: `${origin}/admin/users?onboarding=return`,
  });
}

export async function fetchAccount({ accountId }) {
  const stripe = getStripe();
  return stripe.accounts.retrieve(accountId);
}

export async function setWeeklyPayoutSchedule({ accountId, anchor = "friday" }) {
  const stripe = getStripe();
  // anchor accepts mon-sun in Stripe; map simple aliases
  const map = {
    monday: "mon", tuesday: "tue", wednesday: "wed",
    thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
    mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat", sun: "sun",
  };
  const day = map[String(anchor).toLowerCase()] || "fri";
  return stripe.accounts.update(accountId, {
    settings: { payouts: { schedule: { interval: "weekly", weekly_anchor: day } } },
  });
}
