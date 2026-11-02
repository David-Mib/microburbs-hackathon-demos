"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MODES, type Mode } from "@/components/listings/data";
import { shortName } from "@/lib/api";

const href = (mode: Mode, suburb: string | null) =>
  `/listings?mode=${mode}${suburb ? `&suburb=${encodeURIComponent(suburb)}` : ""}`;

/** Buy / Rent / Sold tabs and the suburb picker. Both are links, so every view can be shared. */
export function ListingsNav({ mode, suburb, names }: { mode: Mode; suburb: string | null; names: string[] }) {
  const router = useRouter();
  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div role="tablist" aria-label="Listing type" className="flex w-full rounded-xl border border-line bg-card p-1 shadow-card sm:inline-flex sm:w-auto">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <Link
            key={m}
            href={href(m, suburb)}
            role="tab"
            aria-selected={m === mode}
            scroll={false}
            className={`flex-1 rounded-lg px-5 py-2 text-center text-[14.5px] font-medium transition sm:flex-none ${
              m === mode ? "bg-brand text-white shadow-[0_6px_16px_-8px_var(--brand)]" : "text-slate hover:text-ink"
            }`}
          >
            {MODES[m].label}
          </Link>
        ))}
      </div>
      <label className="relative flex min-w-0 items-center sm:w-[300px]">
        <span className="sr-only">Suburb</span>
        <svg className="pointer-events-none absolute left-3.5 text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.4" />
        </svg>
        <select
          value={suburb ?? ""}
          onChange={(e) => router.push(href(mode, e.target.value || null), { scroll: false })}
          className="w-full appearance-none rounded-xl border border-line bg-card py-2.5 pl-10 pr-9 text-[15px] shadow-card outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
        >
          <option value="">All City of Sydney</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {shortName(n)}
            </option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-3.5 text-faint" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </label>
    </div>
  );
}
