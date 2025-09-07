'use client';

import { useRef, useState } from 'react';

export default function CopyField({ value, label = 'Referral link', className = '' }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  async function handleCopy() {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (inputRef.current) {
        inputRef.current.select();
        document.execCommand('copy');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error('Copy failed', e);
      // graceful fallback: select text so user can copy manually
      if (inputRef.current) inputRef.current.select();
      alert('Copy failed. You can select and copy the text manually.');
    }
  }

  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      <input
        ref={inputRef}
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 px-3 py-2 rounded border border-[#222] bg-[#111] text-sm"
      />
      <button type="button" onClick={handleCopy} className="btn btn-outline">
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
