"use client";

import Link from "next/link";
import { RAMPS, rampFor } from "@/components/ChoroplethMap";
import { shortName, suburbHref } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export type Ethnicity = {
  ancestry: { ancestry: string; proportion: number }[];
  birthplace: { country: string; proportion: number }[];
};

/**
 * A suburbs × groups matrix from the same ethnicity/all answers the map uses.
 * Each column is coloured against its own maximum, so a group that is 2% of
 * the city still shows where it concentrates.
 */
export function HeatGrid({
  names,
  data,
  dim,
  columns,
  active,
  onColumn,
}: {
  names: string[];
  data: (Ethnicity | null)[];
  dim: "ancestry" | "birthplace";
  columns: string[];
  active: string;
  onColumn: (c: string) => void;
}) {
  const theme = useTheme();
  const ramp = rampFor(RAMPS.magma, theme);
  const value = (e: Ethnicity | null, col: string) =>
    dim === "ancestry"
      ? e?.ancestry.find((a) => a.ancestry === col)?.proportion
      : e?.birthplace.find((b) => b.country === col)?.proportion;

  const rows = names
    .map((name, i) => ({ name, e: data[i] }))
    .filter((r) => r.e)
    .sort((a, b) => (value(b.e, active) ?? -1) - (value(a.e, active) ?? -1));
  const colMax = new Map(columns.map((c) => [c, Math.max(1e-9, ...rows.map((r) => value(r.e, c) ?? 0))]));
  const cell = (v: number | undefined, c: string) => {
    if (v == null) return undefined;
    const t = v / colMax.get(c)!;
    return ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
  };

  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
      <table className="w-full min-w-[760px] border-separate border-spacing-[3px] text-[12px]">
        <thead>
          <tr>
            <th className="w-[130px]" />
            {columns.map((c) => (
              <th key={c} className="h-[92px] align-bottom font-normal">
                <button
                  type="button"
                  onClick={() => onColumn(c)}
                  title={`Map ${c}`}
                  className={`mx-auto block max-h-[88px] whitespace-nowrap text-left [writing-mode:vertical-rl] rotate-180 ${
                    c === active ? "font-semibold text-ink" : "text-slate hover:text-ink"
                  }`}
                >
                  {short(c)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th className="truncate pr-2 text-left font-normal">
                <Link prefetch={false} href={suburbHref(r.name)} className="text-slate hover:text-ink">
                  {shortName(r.name)}
                </Link>
              </th>
              {columns.map((c) => {
                const v = value(r.e, c);
                const bg = cell(v, c);
                const t = v != null ? v / colMax.get(c)! : 0;
                return (
                  <td
                    key={c}
                    title={`${shortName(r.name)}, ${c}: ${v != null ? (v * 100).toFixed(1) + "%" : "not in the top ten"}`}
                    className={`h-7 min-w-[54px] rounded-[5px] text-center tabular-nums ${
                      c === active ? "outline outline-1 outline-brand/60" : ""
                    }`}
                    style={{
                      background: bg ?? "transparent",
                      // Dark text on the bright end of the ramp, light text on the deep end.
                      color: bg ? ((theme === "dark" ? t > 0.55 : t <= 0.55) ? "#0b0f19" : "#ffffff") : "var(--faint)",
                    }}
                  >
                    {v != null ? `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%` : "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[12px] text-faint">
        Percent of residents. A stronger colour means a bigger share within that column; a dot means not in the
        suburb&apos;s top ten.
      </p>
    </div>
  );
}

/** "Middle Easterners and North Africans" is long for a column head. */
const short = (s: string) =>
  ({
    "Northern and Western Europeans": "N & W Europeans",
    "Middle Easterners and North Africans": "Middle East & N Africa",
    "South and Central Americans": "S & C Americans",
  })[s] ?? s;
