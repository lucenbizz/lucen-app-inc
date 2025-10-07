"use client";
import { useEffect, useState } from "react";
export default function AdminGate({ children, passcode }) {
const code = passcode || process.env.NEXT_PUBLIC_ADMIN_PASSCODE ||
"legitbizz";
const [ok, setOk] = useState(false);
const [input, setInput] = useState("");
useEffect(() => {
try {
if (localStorage.getItem("admin_ok") === "1") setOk(true);
} catch {}
}, []);
function submit(e) {
e.preventDefault();
if (input === code) {
localStorage.setItem("admin_ok", "1");
setOk(true);
} else {
alert("Wrong passcode");
}
}
if (ok) return children;
return (
<form onSubmit={submit} className="max-w-sm mx-auto p-6 space-y-3">
<h1 className="text-xl font-semibold">Staff / Admin</h1>
<input
type="password"
className="w-full border rounded-xl px-3 py-2"
placeholder="Enter passcode"
value={input}
onChange={(e) => setInput(e.target.value)}
/>
<button className="border rounded-xl px-3 py-2 w-full
hover:shadow">Enter</button>
</form>
);
} 