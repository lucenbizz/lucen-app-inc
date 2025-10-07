// /lib/email.js  (NEW)
import 'server-only';
import { Resend } from 'resend';

const ORIGIN = process.env.APP_ORIGIN || 'https://lucen-app-inc.vercel.app';
const FROM = process.env.RESEND_FROM_EMAIL || 'Lucen <noreply@lucen-app-inc.vercel.app>';

export function appOrigin() {
  return ORIGIN;
}

/**
 * Send an email via Resend.
 * Returns { id } when actually sent, or { simulated: true } if no API key.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!to) throw new Error('Missing "to" address');

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log('[email:simulate]', { to, subject });
    return { simulated: true };
  }

  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  });

  if (error) throw new Error(error.message || String(error));
  return { id: data?.id };
}
