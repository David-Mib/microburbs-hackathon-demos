import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/PageShell";
import { Card, Kpi, SectionGhost } from "@/components/report/ui";
import { type SuburbListItem, safeDecode, shortName } from "@/lib/api";
import { ServerCalls } from "@/lib/api-store";
import { int, money, pct, perWeek } from "@/lib/format";
import { api } from "@/lib/server/microburbs";
import { loadReport } from "./data";
import { ReportMap } from "./ReportMap";
import { SectionNav } from "./SectionNav";
import {
  DevelopmentSection,
  LifestyleSection,
  MarketSection,
  NearbySection,
  PeopleSection,
  RisksSection,
  SafetySection,
} from "./sections";

// Each report renders on its first visit, then is served from cache and
// refreshed in the background at most once an hour.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ name: string }> };

/** The exact suburb name for the URL segment, or null if it isn't one of the 29. */
async function resolve(params: Params["params"]) {
  const { name: raw } = await params;
  const name = safeDecode(raw);
  const list = await api<SuburbListItem[]>("/v1/suburbs/list");
  const known = (list.data ?? []).map((s) => s.suburb);
  return { name: known.includes(name) ? name : null, known, listCall: list.call };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { name } = await resolve(params);
  return name
    ? {
        title: `${shortName(name)} suburb report`,
        description: `Property market, prices and rents, crime, schools, lifestyle, risks and demographics for ${shortName(name)}, NSW.`,
      }
    : { title: "Suburb not found" };
}

export default async function Page({ params }: Params) {
  const { name, known, listCall } = await resolve(params);
  if (!name) notFound();

  // Start every call now; the hero waits for its three, the sections stream in.
  const r = loadReport(name);
  const [summary, market, livability] = await Promise.all([r.summary, r.market, r.livability]);
  const s = summary.data;
  const m = market.data;
  const top = [...(livability.data?.scores ?? [])]
    .filter((x) => x.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const props = { r, name, known };

  return (
    <PageShell
      slug="suburbs"
      eyebrow={
        <Link href="/suburbs" className="hover:text-ink">
          Suburb report
        </Link>
      }
      title={shortName(name)}
      intro={
        s ? (
          <span>
            {s.state_abbr} {s.postcode} · {s.sa3} · {int(s.population)} residents in {int(s.dwellings)} homes
          </span>
        ) : null
      }
      endpoints={undefined}
    >
      <ServerCalls calls={[listCall, summary.call, market.call, livability.call]} />
      <SectionNav />

      <div className="grid gap-14">
        <section id="overview" className="scroll-mt-32">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Median house" value={money(m?.median_sale_price?.house)} sub={m?.median_sale_price?.house ? "sale price" : "too few house sales"} />
            <Kpi label="Median unit" value={money(m?.median_sale_price?.unit)} sub={m?.median_sale_price?.unit ? "sale price" : "too few unit sales"} />
            <Kpi label="House rent" value={perWeek(m?.median_rent?.house)} sub="median, a week" />
            <Kpi label="Unit rent" value={perWeek(m?.median_rent?.unit)} sub="median, a week" />
            <Kpi label="Unit yield" value={pct(m?.yield_pct?.unit, 1)} sub={`gross · houses ${pct(m?.yield_pct?.house, 1)}`} />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <Card title="Block by block" note="Each mesh block of the suburb (30 to 60 homes) over the street map.">
              <ReportMap suburb={name} />
            </Card>
            <Card title="Character" note="Its strongest and weakest livability scores, out of 100.">
              {top.length ? (
                <ul className="grid gap-3">
                  {top.map((x, i) => (
                    <li key={x.key} className="flex items-center gap-3">
                      <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[16px] font-semibold tabular-nums ${
                          i < 3 ? "bg-accent/15 text-accent" : i >= top.length - 2 ? "bg-ink/[.06] text-slate" : "bg-brand-wash text-brand-deep"
                        }`}
                      >
                        {x.value}
                      </span>
                      <span>
                        <span className="block text-[14.5px] font-medium">{x.label}</span>
                        <span className="text-[12.5px] text-faint">{x.level}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-slate">{livability.message ?? "No livability scores."}</p>
              )}
            </Card>
          </div>
        </section>

        <Suspense fallback={<SectionGhost />}>
          <MarketSection {...props} />
        </Suspense>
        <Suspense fallback={<SectionGhost />}>
          <SafetySection {...props} />
        </Suspense>
        <Suspense fallback={<SectionGhost blocks={1} height={140} />}>
          <RisksSection {...props} />
        </Suspense>
        <Suspense fallback={<SectionGhost />}>
          <DevelopmentSection {...props} />
        </Suspense>
        <Suspense fallback={<SectionGhost />}>
          <LifestyleSection {...props} />
        </Suspense>
        <Suspense fallback={<SectionGhost />}>
          <PeopleSection {...props} />
        </Suspense>
        <Suspense fallback={<SectionGhost blocks={1} height={120} />}>
          <NearbySection {...props} />
        </Suspense>
      </div>
    </PageShell>
  );
}
