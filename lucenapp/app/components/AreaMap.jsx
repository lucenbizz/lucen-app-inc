"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
// Dynamically import react-leaflet pieces to ensure client-side render
const MapContainer = dynamic(() => import("react-leaflet").then(m =>
m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer),
{ ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), {
ssr: false });
const Circle = dynamic(() => import("react-leaflet").then(m => m.Circle), {
ssr: false });
// Fix default marker icons (Next bundling)
import L from "leaflet";
L.Icon.Default.mergeOptions({
iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/markericon-2x.png",
iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});
const R = 6371; // km
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
function haversineKm(lat1, lon1, lat2, lon2) {
const dLat = toRad((lat2 || 0) - (lat1 || 0));
const dLon = toRad((lon2 || 0) - (lon1 || 0));
const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1 || 0)) *
Math.cos(toRad(lat2 || 0)) * Math.sin(dLon / 2) ** 2;
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
return R * c;
}
function destPoint(lat, lon, bearingDeg, distanceKm) {
const br = toRad(bearingDeg);
const dr = distanceKm / R;
const lat1 = toRad(lat);
const lon1 = toRad(lon);
const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) *
Math.sin(dr) * Math.cos(br));
const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(dr) * Math.cos(lat1),
Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2));
return { lat: toDeg(lat2), lng: ((toDeg(lon2) + 540) % 360) - 180 };
}
function colorForTag(tag) {
if (!tag) return "#00aaff";
let h = 0; for (let i = 0; i < tag.length; i++) h = (h * 31 +
tag.charCodeAt(i)) % 360;
return `hsl(${h} 70% 45%)`;
}
export default function AreaMap({
center = { lat: 40.7128, lng: -74.006 },
radiusKm = 10,
height = 360,
editable = false,
onChange, // ({center_lat, center_lng, radius_km})
areas = [], // [{tag, center_lat, center_lng, radius_km, active}]
highlightTag,
}) {
const [view, setView] = useState(center);
const [zoom, setZoom] = useState(11);
useEffect(() => { setView(center); }, [center.lat, center.lng]);
// Handle is placed due East from center at current radius
const handlePos = useMemo(() => destPoint(center.lat, center.lng, 90,
Math.max(radiusKm, 0.05)), [center, radiusKm]);
function onCenterDragEnd(e) {
const ll = e.target.getLatLng();
onChange && onChange({ center_lat: ll.lat, center_lng: ll.lng, radius_km:
radiusKm });
}
function onHandleDrag(e) {
const ll = e.target.getLatLng();
const km = Math.max(0.05, haversineKm(center.lat, center.lng, ll.lat,
ll.lng));
onChange && onChange({ center_lat: center.lat, center_lng: center.lng,
radius_km: km });
}
return (
<div className="w-full rounded-2xl overflow-hidden border" style={{
height }}>
<MapContainer center={[view.lat, view.lng]} zoom={zoom} style={{ height:
"100%", width: "100%" }} scrollWheelZoom>
<TileLayer
attribution='&copy; <a href="https://www.openstreetmap.org/
copyright">OpenStreetMap</a> contributors'
url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
/>
{/* Other areas (for context) */}
{areas.map((a) => (
<Circle key={a.tag}
center={[a.center_lat, a.center_lng]}
radius={(a.radius_km || 0) * 1000}
pathOptions={{ color: colorForTag(a.tag), opacity: a.tag ===
highlightTag ? 1 : 0.5, fillOpacity: a.tag === highlightTag ? 0.08 : 0.05 }}
/>
))}
{/* Active area */}
<Circle center={[center.lat, center.lng]} radius={Math.max(radiusKm,
0.05) * 1000} pathOptions={{ color: "#111827", weight: 2, fillOpacity: 0.04 }} /
>
{/* Center marker */}
<Marker position={[center.lat, center.lng]} draggable={!!editable}
eventHandlers={{ dragend: onCenterDragEnd }} />
{/* Radius handle marker */}
{editable && (
<Marker position={[handlePos.lat, handlePos.lng]} draggable
eventHandlers={{ drag: onHandleDrag }} />
)}
</MapContainer>
</div>
);
} 