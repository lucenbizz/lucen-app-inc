"use client";
import { useEffect } from "react";

export default function RefCapture() {
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const ref = qs.get("ref");
      if (ref) localStorage.setItem("lucen_ref", ref);
    } catch {}
  }, []);
  return null;
}
