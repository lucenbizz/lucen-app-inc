"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { generateTwentyMinuteSlots, filterPastSlots,
localDateWithMinutesToISO } from "../lib/timeSlots";
export default function DeliveryTimePicker({
defaultDate,
timezone = "America/New_York",
leadMinutes = 0,
requireCapacity = false, 
onPicked,
}) {
const [date, setDate] = useState(() => {
if (defaultDate) return defaultDate;
const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, "0");
const dd = String(now.getDate()).padStart(2, "0");
return `${yyyy}-${mm}-${dd}`;
});
const [slots, setSlots] = useState([]);
const [loading, setLoading] = useState(false);
const [selected, setSelected] = useState(null);
const baseSlots = useMemo(() => generateTwentyMinuteSlots(), []);
useEffect(() => {
async function fetchSlots() {
setLoading(true);
try {
const params = new URLSearchParams({ date, tz: timezone });
if (requireCapacity) params.set("cap", "1");
const res = await fetch(`/api/slots?${params.toString()}`);
const json = await res.json();
if (json?.slots) {
const filtered = filterPastSlots(json.slots, date, leadMinutes);
setSlots(filtered);
} else {
setSlots([]);
}
} catch (e) {
setSlots([]);
} finally {
setLoading(false);
}
}
fetchSlots();
}, [date, timezone, leadMinutes, requireCapacity]);
function handlePick(minutes) {
setSelected(minutes);
const startIso = localDateWithMinutesToISO(date, minutes, timezone);
const endIso = localDateWithMinutesToISO(date, minutes + 20, timezone);
const label = baseSlots.find((s) => s.minutes === minutes)?.label ?? "";
onPicked?.({ date, minutes, startIso, endIso, label });
}
return (
<div className="space-y-4">
<div>
<label className="block text-sm font-medium mb-1">Delivery Date</label>
<input
type="date"
className="w-full rounded-xl border px-3 py-2"
value={date}
onChange={(e) => setDate(e.target.value)}
/>
<p className="text-xs text-gray-500 mt-1">24-hour service; 20-minute
slots.</p>
</div>
<div className="flex items-center justify-between">
<span className="text-sm font-medium">Time Slots ({timezone})</span>
{loading && <span className="text-xs text-gray-500">Loading…</span>}
</div>
<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:gridcols-8 gap-2">
{slots.map((s) => {
const isSelected = s.minutes === selected;
const disabled = s.available === false;
return (
<motion.button
key={s.minutes}
whileHover={{ scale: disabled ? 1.0 : 1.03 }}
whileTap={{ scale: disabled ? 1.0 : 0.98 }}
onClick={() => !disabled && handlePick(s.minutes)}
className={[
"rounded-xl px-2 py-2 text-sm border transition",
disabled ? "opacity-40 cursor-not-allowed" : "hover:shadow",
isSelected ? "border-black shadow" : "border-gray-200",
].join(" ")}
aria-disabled={disabled}
title={disabled ? "Unavailable" : `Pick ${s.label}`}
>
<div className="font-mono">{s.label}</div>
{disabled ? (
<div className="text-[10px] text-red-600">Full</div>
) : (
<div className="text-[10px] text-green-600">Available</div>
)}
</motion.button>
);
})}
</div>
{selected !== null && (
<div className="text-sm text-gray-700">
Selected: <span className="font-semibold">{baseSlots.find((x) =>
x.minutes === selected)?.label}</span> on{" "}
<span className="font-semibold">{date}</span>
</div>
)}
</div>
);
} 