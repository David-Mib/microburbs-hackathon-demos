"use client";

import { type Call, useApiLog } from "@/lib/api-store";
import { demoBySlug } from "@/lib/pages";
import { Inspector } from "./Inspector";

/**
 * Page frame: the product on the left, the request inspector on the right.
 * Each route gets its own call log (see ApiProvider in the root layout).
 */
export function PageShell({
  slug,
  eyebrow = "City of Sydney",
  title,
  intro,
  endpoints,
  controls,
  hero,
  children,
}: {
  /** A demo from lib/pages.ts: fills in the title, intro and endpoint list. */
  slug?: string;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  intro?: React.ReactNode;
  /** Endpoint templates the page calls, as the API reference names them. */
  endpoints?: string[];
  controls?: React.ReactNode;
  /** Extra content under the title (a search box, a stat strip). */
  hero?: React.ReactNode;
  children: React.ReactNode;
}) {
  const demo = slug ? demoBySlug(slug) : undefined;
  title ??= demo?.name;
  intro ??= demo?.pitch;
  endpoints ??= demo?.endpoints;
  return (
    <div className="api-grid mx-auto grid max-w-[1680px] lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
      <main className="min-w-0 px-4 pb-24 pt-8 sm:px-6 lg:pb-16 lg:pr-8">
        {(title || hero) && (
          <header className={hero ? "" : "max-w-[860px]"}>
            {eyebrow && (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-[12px] font-medium uppercase tracking-[.08em] text-slate">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {eyebrow}
              </div>
            )}
            {title && (
              <h1 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[44px]">{title}</h1>
            )}
            {intro && <div className="mt-3 max-w-[70ch] text-[16.5px] leading-[1.55] text-slate">{intro}</div>}
            {endpoints && endpoints.length > 0 && (
              <details className="group mt-3 text-[13.5px]">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-brand-deep hover:underline">
                  <span className="font-mono text-[12px]">{"</>"}</span>
                  <span className="group-open:hidden">The {endpoints.length} endpoints this page calls</span>
                  <span className="hidden group-open:inline">Hide endpoints</span>
                </summary>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {endpoints.map((e) => (
                    <li key={e} className="rounded-md border border-line bg-card px-2 py-1 font-mono text-[11.5px] text-slate">
                      {e}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {hero}
          </header>
        )}
        {controls && <div className="mt-6">{controls}</div>}
        <div className="mt-6">{children}</div>
      </main>
      <Inspector />
    </div>
  );
}

/**
 * A titled block of the product. Its footer names the calls behind it, and
 * clicking one opens that call in the request inspector.
 */
export function Panel({
  title,
  note,
  calls,
  className = "",
  action,
  children,
}: {
  title: React.ReactNode;
  note?: React.ReactNode;
  calls: (Call | undefined)[];
  className?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-line bg-card shadow-card ${className}`}>
      <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>
          {note && <p className="mt-1 text-[14px] leading-[1.45] text-slate">{note}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 px-5 py-4 sm:px-6">{children}</div>
      <SourceLine calls={calls} />
    </section>
  );
}

export function SourceLine({ calls }: { calls: (Call | undefined)[] }) {
  const { select, selected } = useApiLog();
  const real = calls.filter((c): c is Call => !!c);
  if (!real.length) return <div className="h-10 border-t border-line" />;
  const shown = real.slice(0, 6);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line px-5 py-2.5 sm:px-6">
      {shown.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => select(c.id, window.matchMedia("(max-width: 1023px)").matches)}
          className={`flex items-center gap-1.5 rounded font-mono text-[11.5px] hover:text-brand-deep ${
            selected === c.id ? "text-brand-deep" : "text-faint"
          }`}
          title="Show this call in the request inspector"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              c.state === "pending" ? "bg-faint" : c.state === "done" ? "bg-ok" : "bg-bad"
            }`}
          />
          {shortPath(c.path)}
        </button>
      ))}
      {real.length > shown.length && (
        <span className="font-mono text-[11.5px] text-faint">+{real.length - shown.length} more in the inspector</span>
      )}
    </div>
  );
}

/** "/v1/suburbs/Surry%20Hills/market/all" → "/market/all" */
const shortPath = (p: string) => p.replace(/^\/v1\/(suburbs|properties)\/[^/]+/, "").replace(/^\/v1/, "") || p;

/** Loading and failure states inside a panel. */
export function Pending({ height = 160 }: { height?: number }) {
  return <div className="ghost rounded-xl" style={{ height }} aria-label="Loading" />;
}

export function Failed({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-bad/30 bg-bad/5 px-3 py-2.5 text-[14px] leading-[1.45] text-ink">{message}</p>
  );
}

export function NoData({ children = "The API has no figure for this one." }: { children?: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-[14px] text-slate">{children}</p>;
}

/** Big number with a label, for KPI rows. */
export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "up" | "down";
}) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-slate">{label}</div>
      <div
        className={`mt-1 truncate text-[26px] font-semibold tabular-nums leading-none tracking-[-0.02em] ${
          tone === "up" ? "text-ok-deep" : tone === "down" ? "text-bad" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12.5px] leading-[1.35] text-faint">{sub}</div>}
    </div>
  );
}
