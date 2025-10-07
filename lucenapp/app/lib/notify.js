export async function sendEmail({ to, subject, html }) {
if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
const res = await fetch("https://api.resend.com/emails", {
method: "POST",
headers: {
Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
"Content-Type": "application/json",
},
body: JSON.stringify({
from: process.env.RESEND_FROM_EMAIL,
to: Array.isArray(to) ? to : [to],
subject,
html,
}),
});
if (!res.ok) throw new Error("Email send failed");
}
export async function sendSMS({ to, body }) {
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !
process.env.TWILIO_FROM) return;
const url = `https://api.twilio.com/2010-04-01/Accounts/$
{process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
const creds = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:$
{process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
const form = new URLSearchParams({ From: process.env.TWILIO_FROM, To: to,
Body: body });
const res = await fetch(url, { method: "POST", headers: { Authorization:
`Basic ${creds}` }, body: form });
if (!res.ok) throw new Error("SMS send failed");
}
export function slotLabel(minutes) {
return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes
% 60).padStart(2, "0")}`;
} 