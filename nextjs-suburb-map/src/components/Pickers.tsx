"use client";

import { useSuburbList } from "@/lib/area";

/**
 * The 29 suburbs, as a dropdown. The options come from GET /v1/suburbs/list
 * (it shows up in the request inspector), so names are always the exact ones
 * the API expects.
 */
export function SuburbSelect({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const { names, loading } = useSuburbList();
  const options = names.includes(value) || !value ? names : [value, ...names];
  return (
    <label className="relative inline-flex items-center gap-3 text-[14px] font-medium">
      <span className="text-slate">Suburb</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading && !names.length}
        className="min-w-[240px] cursor-pointer appearance-none rounded-xl border border-line bg-card py-2.5 pl-3.5 pr-10 text-[15px] font-medium text-ink shadow-card outline-none transition hover:border-brand/40 focus:border-brand focus:ring-4 focus:ring-brand/15"
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        {!options.length && <option value={value}>{value}</option>}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 text-faint"
        width="14"
        height="14"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M3 4.5l3 3 3-3" />
      </svg>
    </label>
  );
}

export type Option = { value: string; label: string; hint?: string };

/**
 * A radio group styled as chips. Scrolls sideways on narrow screens rather
 * than wrapping into a wall.
 */
export function Choices({
  label,
  value,
  onChange,
  options,
  size = "md",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  size?: "md" | "sm";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={`flex items-baseline gap-1.5 whitespace-nowrap rounded-full border ${
                size === "sm" ? "px-3 py-1 text-[13px]" : "px-3.5 py-1.5 text-[14px]"
              } ${
                on
                  ? "border-ink bg-ink text-on-ink"
                  : "border-line bg-card text-ink hover:border-ink/40"
              }`}
            >
              {o.label}
              {o.hint && <span className={`text-[11px] ${on ? "text-on-ink/60" : "text-faint"}`}>{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
