/**
 * Building blocks for report pages. Plain HTML and CSS, no client JS, so they
 * render on the server and look right in dark and light (colours come from the
 * theme's CSS variables).
 */

/** A report section: anchor, eyebrow, title, one-line summary. */
export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32 border-t border-line pt-10 first:border-t-0 first:pt-0">
      <div className="mb-6 max-w-[780px]">
        <div className="text-[12px] font-medium uppercase tracking-[.12em] text-brand-deep">{eyebrow}</div>
        <h2 className="mt-1.5 text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-[30px]">{title}</h2>
        {lede && <p className="mt-2 text-[15.5px] leading-[1.55] text-slate">{lede}</p>}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

/** A plain card (no API footer), for report blocks whose calls the inspector already lists. */
export function Card({
  title,
  note,
  className = "",
  children,
}: {
  title?: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6 ${className}`}>
      {title && <h3 className="text-[15.5px] font-semibold tracking-[-0.01em]">{title}</h3>}
      {note && <p className="mt-1 text-[13.5px] leading-[1.45] text-slate">{note}</p>}
      <div className={title || note ? "mt-4" : ""}>{children}</div>
    </div>
  );
}

/** A big figure with a label and an optional small line under it. */
export function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "up" | "down" | null;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-card px-5 py-4 shadow-card">
      <div className="text-[12px] font-medium uppercase tracking-[.08em] text-faint">{label}</div>
      <div
        className={`mt-1.5 truncate text-[22px] font-semibold leading-none tracking-[-0.025em] sm:text-[28px] ${
          tone === "up" ? "text-ok-deep" : tone === "down" ? "text-bad" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-2 truncate text-[12.5px] text-slate">{sub}</div>}
    </div>
  );
}

export type Bar = { label: React.ReactNode; value: number; display: React.ReactNode; marker?: number; hint?: React.ReactNode };

/**
 * Horizontal bars, longest first is up to the caller. `marker` draws a tick
 * (a benchmark such as the national median) on the same scale.
 */
export function HBars({
  bars,
  color = "var(--brand)",
  max,
  labelWidth = 150,
}: {
  bars: Bar[];
  color?: string;
  max?: number;
  labelWidth?: number;
}) {
  const top = max ?? Math.max(...bars.map((b) => Math.max(b.value, b.marker ?? 0)), 1e-9);
  return (
    <ul className="grid gap-2.5">
      {bars.map((b, i) => (
        <li
          key={i}
          className="grid items-center gap-3 text-[13.5px]"
          style={{ gridTemplateColumns: `minmax(0, ${labelWidth}px) minmax(0,1fr) auto` }}
        >
          <span className="truncate text-slate">{b.label}</span>
          <span className="relative h-2.5 rounded-full bg-ink/[.06]">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.max((b.value / top) * 100, 1.5)}%`, background: color }}
            />
            {b.marker != null && (
              <span
                className="absolute -top-1 h-[18px] w-[2px] rounded bg-ink/70"
                style={{ left: `${(b.marker / top) * 100}%` }}
                title="Benchmark"
              />
            )}
          </span>
          <span className="text-right font-medium tabular-nums">
            {b.display}
            {b.hint && <span className="ml-1.5 text-[12px] font-normal text-faint">{b.hint}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Vertical columns, e.g. an age profile. */
export function Columns({
  data,
  format,
  color = "var(--brand)",
  height = 160,
}: {
  data: { label: string; value: number }[];
  format: (n: number) => string;
  color?: string;
  height?: number;
}) {
  const top = Math.max(...data.map((d) => d.value), 1e-9);
  return (
    <div>
      <div className="flex items-end gap-[3px] sm:gap-1.5" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${format(d.value)}`}>
            <div
              className="w-full rounded-t-[4px] opacity-85 transition group-hover:opacity-100"
              style={{ height: `${(d.value / top) * 100}%`, background: color }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px] sm:gap-1.5">
        {data.map((d, i) => (
          <div key={d.label} className="flex-1 text-center font-mono text-[9.5px] text-faint">
            {data.length <= 14 || i % 2 === 0 ? d.label.replace(/-\d+$/, "") : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A low–likely–high range on a shared axis, e.g. a growth forecast. */
export function RangeBar({
  low,
  mid,
  high,
  min,
  max,
  format,
  color = "var(--accent)",
}: {
  low: number;
  mid: number;
  high: number;
  min: number;
  max: number;
  format: (n: number) => string;
  color?: string;
}) {
  const pos = (v: number) => `${((v - min) / Math.max(max - min, 1e-9)) * 100}%`;
  return (
    <div className="pt-6 pb-5">
      <div className="relative h-2 rounded-full bg-ink/[.06]">
        <div
          className="absolute inset-y-0 rounded-full opacity-40"
          style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)})`, background: color }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card"
          style={{ left: pos(mid), background: color }}
        />
        <div className="absolute -top-6 -translate-x-1/2 text-[13px] font-semibold tabular-nums" style={{ left: pos(mid) }}>
          {format(mid)}
        </div>
        <div className="absolute top-4 -translate-x-1/2 text-[11.5px] tabular-nums text-faint" style={{ left: pos(low) }}>
          {format(low)}
        </div>
        <div className="absolute top-4 -translate-x-1/2 text-[11.5px] tabular-nums text-faint" style={{ left: pos(high) }}>
          {format(high)}
        </div>
      </div>
    </div>
  );
}

/** A small pill with a tone. */
export function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "good" | "bad" | "warn" | "neutral" }) {
  const cls = {
    good: "bg-ok/12 text-ok-deep",
    bad: "bg-bad/12 text-bad",
    warn: "bg-warn/12 text-warn",
    neutral: "bg-ink/[.06] text-slate",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${cls}`}>{children}</span>;
}

/** Shown in place of a block when the API has no figure. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-3 text-[14px] text-slate">{children}</p>;
}

/** Ghost boxes while a streamed section loads. */
export function SectionGhost({ blocks = 2, height = 220 }: { blocks?: number; height?: number }) {
  return (
    <div className="border-t border-line pt-10">
      <div className="ghost h-3 w-24 rounded" />
      <div className="ghost mt-3 h-7 w-72 max-w-full rounded-lg" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {Array.from({ length: blocks }, (_, i) => (
          <div key={i} className="ghost rounded-2xl" style={{ height }} />
        ))}
      </div>
    </div>
  );
}
