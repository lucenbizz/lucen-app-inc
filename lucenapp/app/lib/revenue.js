// /lib/revenue.js
// Optional helpers used on the server or UI previews (final split happens server-side)

import { DELIVERY_PAYOUT_CENTS, DEFAULT_EXEC_REVENUE_BPS } from "@/lib/pricing";

export function computeSplit({ priceCents, discountCents = 0, tier, execBps = DEFAULT_EXEC_REVENUE_BPS }) {
  const delivery = DELIVERY_PAYOUT_CENTS[String(tier).toLowerCase()] ?? 0;
  const netPaid = Math.max(0, Number(priceCents) - Number(discountCents));
  const splitBase = Math.max(0, netPaid - delivery);
  const execShare = Math.floor(splitBase * (Number(execBps) / 10000));
  const platformShare = splitBase - execShare;
  return { netPaid, deliveryPayoutCents: delivery, splitBase, execShareCents: execShare, platformShareCents: platformShare };
}
