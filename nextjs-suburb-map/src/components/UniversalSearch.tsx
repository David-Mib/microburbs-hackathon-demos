"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { type AddressMatch, type SuburbMatch, shortName, suburbHref } from "@/lib/api";
import { useApi } from "@/lib/api-store";
import { useSuburbList } from "@/lib/area";
import { propertyType } from "@/lib/format";

type Result =
  | { kind: "suburb"; name: string; href: string; sub: string }
  | { kind: "address"; name: string; href: string; sub: string };

/**
 * One box for everything, like the search on microburbs.com.au: type a suburb
 * or an address and go straight to the right page.
 *
 * - Suburbs: matched instantly against GET /v1/suburbs/list (the 29 City of
 *   Sydney names, fetched once). If nothing matches, GET /v1/geocode/suburb
 *   catches typos ("surry hils").
 * - Addresses: GET /v1/geocode/address once the text looks like an address
 *   (has a digit, or is long enough), after a short pause in typing.
 */
export function UniversalSearch({
  size = "lg",
  autoFocus = false,
  onDone,
}: {
  size?: "lg" | "md";
  autoFocus?: boolean;
  /** Called after navigating (closes the palette). */
  onDone?: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 220);
    return () => clearTimeout(t);
  }, [text]);

  const { names } = useSuburbList();
  const q = query.toLowerCase();
  const localSuburbs = useMemo(() => {
    if (!q) return [];
    return names
      .filter((n) => n.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)))
      .slice(0, 5);
  }, [names, q]);

  const looksLikeAddress = /\d/.test(query) || query.length >= 6;
  const addresses = useApi<AddressMatch[]>(
    looksLikeAddress && query.length >= 3 ? `/v1/geocode/address?address=${encodeURIComponent(query)}` : null,
  );
  const fuzzy = useApi<SuburbMatch[]>(
    query.length >= 3 && names.length > 0 && localSuburbs.length === 0 && !/\d/.test(query)
      ? `/v1/geocode/suburb?q=${encodeURIComponent(query)}&state=NSW`
      : null,
  );

  const results: Result[] = useMemo(() => {
    const inArea = new Set(names);
    const suburbs = localSuburbs.length
      ? localSuburbs
      : (fuzzy.data ?? []).map((m) => m.area_name).filter((n) => inArea.has(n)).slice(0, 4);
    return [
      ...suburbs.map((n) => ({ kind: "suburb" as const, name: shortName(n), href: suburbHref(n), sub: "Suburb report" })),
      ...(addresses.data ?? []).slice(0, 6).map((a) => ({
        kind: "address" as const,
        name: a.display_name,
        href: `/property?gnaf=${encodeURIComponent(a.id)}`,
        sub: propertyType(a.property_type) ? `Property · ${propertyType(a.property_type)}` : "Property",
      })),
    ];
  }, [names, localSuburbs, fuzzy.data, addresses.data]);

  const loading = (addresses.loading || fuzzy.loading) && results.length === 0;
  const showPanel = open && text.trim().length > 0;

  function go(r: Result | undefined) {
    if (!r) return;
    setOpen(false);
    router.push(r.href);
    onDone?.();
  }

  const lg = size === "lg";
  return (
    <div className="relative w-full">
      <div
        className={`flex items-center gap-3 rounded-2xl border border-line bg-card shadow-card transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 ${
          lg ? "px-5 py-4" : "px-4 py-3"
        }`}
      >
        <svg width={lg ? 22 : 18} height={lg ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-faint">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={input}
          role="combobox"
          aria-label="Search a suburb or an address"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={text}
          placeholder="Search a suburb or an address, e.g. 26 Tudor Street, Surry Hills"
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint ${lg ? "text-[18px]" : "text-[16px]"}`}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter") go(results[active]);
            else if (e.key === "Escape") setOpen(false);
            else return;
            e.preventDefault();
          }}
        />
        {loading && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-faint border-t-transparent" />}
      </div>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-card text-left shadow-card fade-up">
          {results.length > 0 ? (
            <ul id={listId} role="listbox" className="max-h-[380px] overflow-y-auto p-1.5">
              {results.map((r, i) => (
                <li key={r.href} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === active ? "bg-brand-wash" : ""}`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                        r.kind === "suburb" ? "bg-brand/15 text-brand-deep" : "bg-accent/15 text-accent"
                      }`}
                    >
                      {r.kind === "suburb" ? <PinIcon /> : <HomeIcon />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">{r.name}</span>
                      <span className="block text-[12.5px] text-slate">{r.sub}</span>
                    </span>
                    <span className="text-[12px] text-faint">↵</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-[14px] text-slate">
              {loading || query !== text.trim()
                ? "Searching…"
                : "No match in the City of Sydney. Try a suburb like Glebe or a street address."}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 font-mono text-[11px] text-faint">
            <span>GET /v1/geocode/address · /v1/suburbs/list</span>
            <span className="hidden sm:inline">↑↓ to move · ↵ to open</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
