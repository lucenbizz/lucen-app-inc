export const TWENTY_MINUTES = 20;
export const SLOTS_PER_DAY = (24 * 60) / TWENTY_MINUTES; // 72
export function generateTwentyMinuteSlots() {
const slots = [];
for (let i = 0; i < SLOTS_PER_DAY; i++) {
const minutes = i * TWENTY_MINUTES;
const hh = Math.floor(minutes / 60);
const mm = minutes % 60;
const label = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}
`;
slots.push({ label, minutes });
}
return slots;
}
// Build an ISO string that matches local wall time in the given tz.
export function localDateWithMinutesToISO(dateStr, minutesFromMidnight, tz =
"America/New_York") {
const [y, m, d] = dateStr.split("-").map(Number);
const hours = Math.floor(minutesFromMidnight / 60);
const mins = minutesFromMidnight % 60;
// Tentative UTC
const tentative = new Date(Date.UTC(y, m - 1, d, hours, mins, 0, 0));

const fmt = new Intl.DateTimeFormat("en-US", {
timeZone: tz,
year: "numeric", month: "2-digit", day: "2-digit",
hour: "2-digit", minute: "2-digit", hour12: false,
});
const parts = fmt.formatToParts(tentative);
const get = (t) => Number(parts.find((p) => p.type === t)?.value);
const local = new Date(get("year"), get("month") - 1, get("day"),
get("hour"), get("minute"));
const utcInstant = new Date(local.getTime() - local.getTimezoneOffset() *
60000);
return utcInstant.toISOString();
}
// Hide past slots for 'today' with an optional lead-time in minutes.
export function filterPastSlots(slots, dateStr, leadMinutes = 20) {
const now = new Date();
const [y, m, d] = dateStr.split("-").map(Number);
const isSameDay =
now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d;
if (!isSameDay) return slots;
const nowMins = now.getHours() * 60 + now.getMinutes() + leadMinutes;
return slots.filter((s) => s.minutes >= nowMins);
}