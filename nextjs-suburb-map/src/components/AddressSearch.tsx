"use client";

import { useEffect, useId, useState } from "react";
import type { AddressMatch } from "@/lib/api";
import { useApi } from "@/lib/api-store";

/**
 * Type an address, get GNAF ids back from GET /v1/geocode/address, pick one.
 * Waits for a pause in typing so we don't call the API on every keystroke.
 */
export function AddressSearch({ onPick }: { onPick: (gnaf: string, label: string) => void }) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const search = useApi<AddressMatch[]>(
    query.length >= 4 ? `/v1/geocode/address?address=${encodeURIComponent(query)}` : null,
  );
  const matches = search.data ?? [];

  function choose(m: AddressMatch) {
    onPick(m.id, m.display_name);
    setText(m.display_name);
    setOpen(false);
  }

  return (
    <div className="relative max-w-[620px]">
      <label htmlFor="address-q" className="text-[14px] font-medium">
        Find an address in the City of Sydney
      </label>
      <input
        id="address-q"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={text}
        placeholder="Try “26 Tudor St Surry Hills” or “10 Bridge St Sydney”"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, matches.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && matches[active]) choose(matches[active]);
          else if (e.key === "Escape") setOpen(false);
          else return;
          e.preventDefault();
        }}
        className="mt-1.5 w-full rounded-xl border border-line bg-card px-4 py-3 text-[17px] outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
      />
      {open && query.length >= 4 && !search.loading && (matches.length > 0 || search.message) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-[0_12px_32px_rgba(15,27,45,.12)]"
        >
          {matches.map((m, i) => (
            <li
              key={m.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(m);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 text-[15px] ${
                i === active ? "bg-brand-wash" : ""
              }`}
            >
              <span>{m.display_name}</span>
              <span className="shrink-0 font-mono text-[11px] text-faint">{m.id}</span>
            </li>
          ))}
          {!matches.length && <li className="px-4 py-2 text-[14px] text-slate">{search.message}</li>}
        </ul>
      )}
    </div>
  );
}
