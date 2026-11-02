"use client";

import { LineChart, type Series } from "@/components/LineChart";
import { money, moneyFull } from "@/lib/format";

/** "dollars" is for weekly rents: the card title says "weekly", so the axis stays short. */
const FORMATS = { money, dollars: moneyFull } as const;

/**
 * LineChart for server components: they can't pass a format function to the
 * client, so they name one.
 */
export function TrendChart({
  series,
  format,
  height = 240,
}: {
  series: Series[];
  format: keyof typeof FORMATS;
  height?: number;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-[12.5px] text-slate">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <LineChart series={series} format={FORMATS[format]} height={height} />
    </div>
  );
}
