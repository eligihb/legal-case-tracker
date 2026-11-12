'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  value?: string | null;
  label?: string;
  className?: string;
}

export default function CopyButton({
  value,
  label = 'העתק ללוח',
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!value || !value.trim()) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value.trim();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`${label}: ${value}`}
      className={`no-print inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-bold transition border ${
        copied
          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
          : 'bg-slate-100/80 hover:bg-blue-100 text-slate-600 hover:text-blue-800 border-slate-200/80'
      } ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="text-[11px] font-extrabold">הועתק!</span>
        </>
      ) : (
        <Copy className="w-3.5 h-3.5 shrink-0" />
      )}
    </button>
  );
}
