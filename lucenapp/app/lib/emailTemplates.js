// /lib/emailTemplates.js  (NEW)
import 'server-only';
import { appOrigin } from './email.js';

function fmtSlot(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York' }); }
  catch { return iso; }
}

export function tplRequestApproved({ to, tier, area, slotIso }) {
  const origin = appOrigin();
  const cta = `${origin}/checkout?tier=${encodeURIComponent(tier)}${slotIso ? `&slot=${encodeURIComponent(slotIso)}` : ''}${area ? `&area=${encodeURIComponent(area)}` : ''}`;

  const subject = `Good news — we can fulfill your delivery in ${area || 'your area'}`;
  const text = [
    `Hi,`,
    ``,
    `We now have coverage in ${area || 'your area'}.`,
    `Tier: ${tier}`,
    `Requested slot: ${fmtSlot(slotIso)}`,
    ``,
    `Complete your purchase: ${cta}`,
    ``,
    `— Lucen`,
  ].join('\n');

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#0f172a">
    <h2 style="margin:0 0 12px">We can fulfill your delivery${area ? ` in <span style="color:#0ea5e9">${area}</span>` : ''} 🎉</h2>
    <p style="margin:6px 0">Tier: <b style="text-transform:capitalize">${tier}</b></p>
    <p style="margin:6px 0">Requested time: <b>${fmtSlot(slotIso)}</b></p>
    <p style="margin:16px 0">Finish your checkout and pick your 20-minute slot:</p>
    <p><a href="${cta}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:12px">Complete checkout</a></p>
    <p style="margin-top:16px;font-size:12px;color:#475569">If the button doesn’t work, open: <br/><span style="word-break:break-all">${cta}</span></p>
    <p style="margin-top:24px">— Lucen</p>
  </div>`.trim();

  return { to, subject, html, text };
}

export function tplOrderCreated({ to, orderId, tier, area, slotIso }) {
  const origin = appOrigin();
  const ordersLink = `${origin}/account/orders?highlight=${encodeURIComponent(orderId)}`;
  const subject = `Your Lucen order is ready (ID: #${orderId})`;

  const text = [
    `Hi,`,
    ``,
    `We created your order.`,
    `Order ID: #${orderId}`,
    `Tier: ${tier}`,
    `Area: ${area || '—'}`,
    `Scheduled slot: ${fmtSlot(slotIso)}`,
    ``,
    `View your orders: ${ordersLink}`,
    ``,
    `— Lucen`,
  ].join('\n');

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#0f172a">
    <h2 style="margin:0 0 12px">Your order is ready ✅</h2>
    <p style="margin:6px 0">Order ID: <b>#${orderId}</b></p>
    <p style="margin:6px 0">Tier: <b style="text-transform:capitalize">${tier}</b></p>
    <p style="margin:6px 0">Area: <b>${area || '—'}</b></p>
    <p style="margin:6px 0">Scheduled slot: <b>${fmtSlot(slotIso)}</b></p>
    <p style="margin:16px 0">You can track it here:</p>
    <p><a href="${ordersLink}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:12px">View my orders</a></p>
    <p style="margin-top:16px;font-size:12px;color:#475569">If the button doesn’t work, open: <br/><span style="word-break:break-all">${ordersLink}</span></p>
    <p style="margin-top:24px">— Lucen</p>
  </div>`.trim();

  return { to, subject, html, text };
}
