"use client";

import { useState } from "react";

export default function CopyField({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error(e);
      alert("Copy failed. You can select & copy manually.");
    }
  };

  return (
    <div className="flex items-stretch gap-2">
      <input
        readOnly
        value={value}
        className="flex-1 px-3 py-2 rounded border border-[#222] bg-[#111] text-sm"
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Referral link"
      />
      <button className="btn btn-outline" onClick={copy} type="button">
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
