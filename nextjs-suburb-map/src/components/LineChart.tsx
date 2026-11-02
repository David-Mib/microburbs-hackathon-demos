"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Point } from "@/lib/api";
import { date as fmtDate } from "@/lib/format";

export type Series = { name: string; color: string; points: Point[] };

const M = { top: 12, right: 12, bottom: 26, left: 58 };

/** A small time-series chart: SVG, measured to its container, with a hover readout. */
export function LineChart({
  series,
  format,
  height = 220,
}: {
  series: Series[];
  format: (n: number) => string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverT, setHoverT] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const parsed = useMemo(
    () =>
      series
        .map((s) => ({
          ...s,
          pts: s.points
            .filter((p) => Number.isFinite(p.value))
            .map((p) => ({ t: Date.parse(p.date), v: p.value }))
            .filter((p) => Number.isFinite(p.t))
            .sort((a, b) => a.t - b.t),
        }))
        .filter((s) => s.pts.length > 1),
    [series],
  );

  const all = parsed.flatMap((s) => s.pts);
  if (!all.length) return <div ref={ref} className="text-[14px] text-slate">No series to draw.</div>;

  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  const [y0, y1, ticks] = niceScale(Math.min(...all.map((p) => p.v)), Math.max(...all.map((p) => p.v)));
  const iw = Math.max(width - M.left - M.right, 10);
  const ih = height - M.top - M.bottom;
  const x = (t: number) => M.left + ((t - t0) / Math.max(t1 - t0, 1)) * iw;
  const y = (v: number) => M.top + ih - ((v - y0) / Math.max(y1 - y0, 1e-9)) * ih;

  const years: number[] = [];
  const ya = new Date(t0).getFullYear() + 1;
  const yb = new Date(t1).getFullYear();
  const step = Math.max(1, Math.ceil((yb - ya + 1) / Math.max(2, Math.floor(iw / 70))));
  for (let yr = ya; yr <= yb; yr += step) years.push(yr);

  const nearest = (pts: { t: number; v: number }[], t: number) =>
    pts.reduce((best, p) => (Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best), pts[0]);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const t = t0 + ((px - M.left) / iw) * (t1 - t0);
    setHoverT(Math.min(t1, Math.max(t0, t)));
  }

  const readout = hoverT != null ? parsed.map((s) => ({ s, p: nearest(s.pts, hoverT) })) : null;

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block touch-pan-y"
          onPointerMove={onMove}
          onPointerLeave={() => setHoverT(null)}
          role="img"
          aria-label={parsed.map((s) => `${s.name}: latest ${format(s.pts[s.pts.length - 1].v)}`).join("; ")}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + iw} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
              <text x={M.left - 8} y={y(v) + 4} textAnchor="end" className="fill-faint text-[11px]">
                {format(v)}
              </text>
            </g>
          ))}
          {years.map((yr) => {
            const t = Date.UTC(yr, 0, 1);
            return (
              <text key={yr} x={x(t)} y={height - 6} textAnchor="middle" className="fill-faint text-[11px]">
                {yr}
              </text>
            );
          })}
          {parsed.map((s) => (
            <path
              key={s.name}
              d={s.pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ))}
          {readout && (
            <g pointerEvents="none">
              <line x1={x(hoverT!)} x2={x(hoverT!)} y1={M.top} y2={M.top + ih} stroke="var(--color-ink)" strokeOpacity={0.25} />
              {readout.map(({ s, p }) => (
                <circle key={s.name} cx={x(p.t)} cy={y(p.v)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      <div className="mt-2 flex min-h-[20px] flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {(readout ?? parsed.map((s) => ({ s, p: s.pts[s.pts.length - 1] }))).map(({ s, p }) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5" style={{ background: s.color }} />
            <span className="text-slate">{s.name}</span>
            <span className="font-semibold tabular-nums">{format(p.v)}</span>
            <span className="text-faint">{fmtDate(new Date(p.t).toISOString())}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function niceScale(lo: number, hi: number): [number, number, number[]] {
  if (lo === hi) {
    lo -= Math.abs(lo) * 0.1 || 1;
    hi += Math.abs(hi) * 0.1 || 1;
  }
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const a = Math.floor(lo / step) * step;
  const b = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return [a, b, ticks];
}
