"use client";

import { useEffect, useState } from "react";
import { UniversalSearch } from "./UniversalSearch";

/** The header's search button: opens the universal search as a palette (also on Ctrl/⌘ K). */
export function SearchPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search a suburb or an address"
        className="flex h-9 items-center gap-2 rounded-lg border border-line bg-card/60 px-2.5 text-[13.5px] text-faint transition hover:border-brand/40 hover:text-ink xl:w-[220px]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
        </svg>
        <span className="hidden xl:inline">Suburb or address</span>
        <kbd className="ml-auto hidden rounded border border-line px-1.5 font-mono text-[11px] xl:inline">⌘K</kbd>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 px-4 pt-[12vh] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="mx-auto max-w-[640px] fade-up">
            <UniversalSearch size="md" autoFocus onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
