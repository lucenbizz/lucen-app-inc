
"use client";

import { useEffect, useState } from "react";
import DeliveryTimePicker from "../../components/DeliveryTimePicker";

const RESCHEDULE_CUTOFF_MIN = 120; // 2 hours
const MAX_RESCHEDULES = 2;

export default function MyOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [slot, setSlot] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/my/orders");
      const json = await res.json();
      setOrders(json.orders || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function submitReschedule(orderId) {
    if (!slot) return alert("Pick a new time");
    const body = { date: slot.date, minutes: slot.minutes, tz: "America/New_York" };
    const res = await fetch(`/api/orders/${orderId}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || "Failed to reschedule");
    setEditingId(null); setSlot(null); load();
  }

  async function cancelOrder(orderId) {
    if (!confirm("Cancel this order?")) return;
    const res = await fetch(`/api/orders/${orderId}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "customer_cancel" }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || "Failed to cancel");
    load();
  }

  function canCancel(o) {
    if (!o || o.status === "canceled" || o.status === "fulfilled" || o.status === "en_route") return false;
    if (!o.delivery_slot_start) return false;
    const now = new Date();
    const start = new Date(o.delivery_slot_start);
    const mins = (start - now) / 60000;
    return mins >= RESCHEDULE_CUTOFF_MIN; // same cutoff for cancel
  }

  function canReschedule(o) {
    if (!o) return false;
    if (o.status === "canceled" || o.status === "fulfilled" || o.status === "en_route") return false;
    if (typeof o.reschedule_count === "number" && o.reschedule_count >= MAX_RESCHEDULES) return false;
    if (!o.delivery_slot_start) return false;
    const now = new Date();
    const start = new Date(o.delivery_slot_start);
    const mins = (start - now) / 60000;
    return mins >= RESCHEDULE_CUTOFF_MIN;
  }

  function rescheduleDisabledReason(o) {
    if (!o) return "";
    if (o.status === "canceled") return "Order is canceled.";
    if (o.status === "fulfilled") return "Already fulfilled.";
    if (o.status === "en_route") return "Order is en route.";
    if (typeof o.reschedule_count === "number" && o.reschedule_count >= MAX_RESCHEDULES) return `Limit reached (${MAX_RESCHEDULES}).`;
    if (!o.delivery_slot_start) return "No scheduled time.";
    const now = new Date();
    const start = new Date(o.delivery_slot_start);
    const mins = (start - now) / 60000;
    if (mins < RESCHEDULE_CUTOFF_MIN) return `Rescheduling closes ${RESCHEDULE_CUTOFF_MIN} min before.`;
    return "";
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Orders</h1>
      {loading && <div>Loading…</div>}

      <div className="grid gap-3">
        {orders.map((o) => (
          <div key={o.id} className="border rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">#{o.id}</div>
                <div className="text-sm">Address: {o.address}</div>
                <div className="text-sm">Slot: <span className="font-mono">{o.slot_label || "—"}</span></div>
                <div className="text-xs text-gray-500">Status: {o.status}</div>
                {o.status === "canceled" && (
                  <div className="text-xs text-red-600">This order is canceled.</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editingId === o.id ? (
                  <>
                    <button className="border rounded-xl px-3 py-2" onClick={() => submitReschedule(o.id)}>Save</button>
                    <button className="border rounded-xl px-3 py-2" onClick={() => { setEditingId(null); setSlot(null); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      className="border rounded-xl px-3 py-2"
                      disabled={!canReschedule(o)}
                      title={rescheduleDisabledReason(o) || undefined}
                      onClick={() => setEditingId(o.id)}
                    >
                      Reschedule
                    </button>
                    <button
                      className="border rounded-xl px-3 py-2"
                      disabled={!canCancel(o)}
                      title={!canCancel(o) ? "Cancellation closes 2 hours before your slot." : undefined}
                      onClick={() => cancelOrder(o.id)}
                    >
                      Cancel Order
                    </button>
                  </>
                )}
              </div>
            </div>

            {editingId === o.id && (
              <div className="pt-2">
                <DeliveryTimePicker timezone="America/New_York" leadMinutes={RESCHEDULE_CUTOFF_MIN} onPicked={setSlot} />
                <p className="text-xs text-gray-500 mt-2">
                  Limit: {MAX_RESCHEDULES} reschedules; cutoff: {RESCHEDULE_CUTOFF_MIN} minutes before the current slot.
                </p>
              </div>
            )}
          </div>
        ))}
        {orders.length === 0 && !loading && <div className="text-gray-600">No upcoming orders.</div>}
      </div>
    </main>
  );
} 

