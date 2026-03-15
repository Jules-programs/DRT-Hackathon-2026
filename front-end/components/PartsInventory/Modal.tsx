// src/components/Modal.tsx
"use client";

import { useEffect, useRef } from "react";

interface Props {
  title:    string;
  open:     boolean;
  onClose:  () => void;
  children: React.ReactNode;
  width?:   string;
}

export function Modal({ title, open, onClose, children, width = "max-w-2xl" }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => closeBtnRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 backdrop-blur-[2px] p-4 pt-16">
      <div className={`relative w-full ${width} rounded-2xl border border-stone-200 bg-white shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h2 className="text-base font-bold text-stone-800">{title}</h2>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
