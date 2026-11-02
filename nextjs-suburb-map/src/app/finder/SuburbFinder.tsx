"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChoroplethMap, type Outline, RAMPS } from "@/components/ChoroplethMap";
import { Failed, NoData, PageShell, Panel, Pending } from "@/components/PageShell";
import { type Feature, shortName, suburbHref, suburbPath } from "@/lib/api";
import { useApi, useApis } from "@/lib/api-store";
import { useSuburbList } from "@/lib/area";
import { int, money, pct } from "@/lib/format";
import { useQueryParam } from "@/lib/use-query-param";

type Field = { key: string; label: string; unit: string };
type Row = { rank: number; suburb: string; value?: number };
type SearchBody = { suburbs: Row[]; meta: { total: number; has_more: boolean; next_offset?: number } };
type Filter = { field: string; min: string; max: string };

/** Format a finder value by the unit /finder/fields gives for it. */
function formatter(unit: string | undefined) {
  if (unit === "currency") return money;
  if (unit === "percent") return (n: number) => pct(n);
  if (unit === "days") return (n: number) => `${Math.round(n)} days`;
  if (unit === "km") return (n: number) => `${n.toFixed(1)} km`;
  return (n: number) => int(n);
}

/**
 * GET /v1/suburbs/finder/search ranks suburbs on any field from
 * /v1/suburbs/finder/fields, optionally filtered by ranges such as
 * `safetyScore:40..`. In the hackathon area it ranks the 29 City of Sydney
 * suburbs; a page holds up to 25 rows, so a full ranking is two calls.
 */
export function SuburbFinder() {
  const router = useRouter();
  const [sortField, setSortField] = useQueryParam("sort", "medianHousePrice");
  const [dir, setDir] = useQueryParam("dir", "desc", ["asc", "desc"]);
  const [draft, setDraft] = useState<Filter[]>([{ field: "safetyScore", min: "", max: "" }]);
  const [filters, setFilters] = useState<Filter[]>([]);

  const fields = useApi<{ fields: Field[] }>("/v1/suburbs/finder/fields");
  const fieldList = fields.data?.fields ?? [];
  const field = fieldList.find((f) => f.key === sortField);

  const query = useMemo(() => {
    const q = new URLSearchParams({ sort: `${dir === "desc" ? "-" : ""}${sortField}`, limit: "25" });
    for (const f of filters) if (f.min || f.max) q.append("filter", `${f.field}:${f.min}..${f.max}`);
    return q;
  }, [sortField, dir, filters]);

  const page1 = useApi<SearchBody>(`/v1/suburbs/finder/search?${query}`);
  const nextOffset = page1.data?.meta.has_more ? (page1.data.meta.next_offset ?? 25) : null;
  const q2 = new URLSearchParams(query);
  q2.set("offset", String(nextOffset));
  const page2 = useApi<SearchBody>(nextOffset != null ? `/v1/suburbs/finder/search?${q2}` : null);
  const countQuery = new URLSearchParams([...query].filter(([k]) => k === "filter"));
  const count = useApi<{ total: number }>(filters.length ? `/v1/suburbs/finder/count?${countQuery}` : null);

  const rows = [...(page1.data?.suburbs ?? []), ...(page2.data?.suburbs ?? [])];
  const total = page1.data?.meta.total ?? 0;

  // The map: each suburb's outline, shaded by its rank (darkest = rank 1).
  const list = useSuburbList();
  const bounds = useApis<{ geojson: Feature }>(list.names.map((n) => suburbPath(n, "shapes/boundary")));
  const boundSig = bounds.map((b) => (b.data ? 1 : 0)).join("");
  const shapes = useMemo(
    () =>
      list.names.flatMap((name, i) => {
        const g = bounds[i]?.data?.geojson;
        return g ? [{ ...g, properties: { mb: name } }] : [];
      }),
    // Recompute when another outline lands.
    [boundSig],
  );
  const outlines = useMemo<Outline[]>(
    () => shapes.map((f) => ({ id: String(f.properties.mb), label: shortName(String(f.properties.mb)), feature: f })),
    [shapes],
  );
  const groups = useMemo(() => new Map(list.names.map((n) => [n, shortName(n)])), [list.names]);
  const ranks = useMemo(() => new Map(rows.map((r) => [r.suburb, total + 1 - r.rank])), [rows, total]);
  const fmt = formatter(field?.unit);

  const select =
    "rounded-lg border border-line bg-card px-3 py-2 text-[14px] outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";

  return (
    <PageShell
      slug="finder"
      controls={
        <div className="grid gap-4 rounded-2xl border border-line bg-card px-5 py-4">
          <div className="flex flex-wrap items-center gap-3 text-[14px]">
            <span className="font-medium">Rank by</span>
            <select value={sortField} onChange={(e) => setSortField(e.target.value)} className={select}>
              {(fieldList.length ? fieldList : [{ key: sortField, label: sortField, unit: "" }]).map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select value={dir} onChange={(e) => setDir(e.target.value)} className={select}>
              <option value="desc">highest first</option>
              <option value="asc">lowest first</option>
            </select>
          </div>
          <div className="grid gap-2">
            {draft.map((f, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-[14px]">
                <span className="w-[52px] font-medium">{i === 0 ? "Where" : "and"}</span>
                <select
                  value={f.field}
                  onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, field: e.target.value } : d)))}
                  className={select}
                >
                  {fieldList.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.label}
                    </option>
                  ))}
                </select>
                <input
                  value={f.min}
                  placeholder="min"
                  inputMode="decimal"
                  onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, min: e.target.value } : d)))}
                  className={`${select} w-24`}
                />
                <span className="text-slate">to</span>
                <input
                  value={f.max}
                  placeholder="max"
                  inputMode="decimal"
                  onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, max: e.target.value } : d)))}
                  className={`${select} w-24`}
                />
                <button
                  type="button"
                  onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                  className="rounded px-2 py-1 text-slate hover:text-ink"
                  aria-label="Remove filter"
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDraft([...draft, { field: "grossYield", min: "", max: "" }])}
                className="rounded-lg border border-line px-3 py-1.5 text-[14px] hover:border-ink/40"
              >
                Add a filter
              </button>
              <button
                type="button"
                onClick={() => setFilters(draft.filter((f) => f.min || f.max))}
                className="rounded-lg bg-ink px-3 py-1.5 text-[14px] font-medium text-on-ink hover:bg-ink/85"
              >
                Apply filters
              </button>
              <span className="text-[13px] text-slate">
                Percentages are fractions (a 3% yield is 0.03); scores run 0 to 100.
              </span>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel
          title="On the map"
          note="Darker is closer to the top of the ranking. Grey suburbs are filtered out. Click one for its snapshot."
          calls={[list.call, ...bounds.map((b) => b.call)]}
        >
          {shapes.length < 2 ? (
            <Pending height={520} />
          ) : (
            <ChoroplethMap
              shapes={shapes}
              outlines={outlines}
              values={ranks}
              format={(n) => `#${total + 1 - Math.round(n)}`}
              ramp={RAMPS.blue}
              legend={`Rank by ${field?.label.toLowerCase() ?? sortField} (#1 is darkest)`}
              noDataLabel="Filtered out"
              hint="Point at a suburb for its rank; click to open it."
              caption="Suburb ranking"
              labelOutlines
              showCodes={false}
              groups={groups}
              onOutlineClick={(label) => {
                const name = list.names.find((n) => shortName(n) === label);
                if (name) router.push(suburbHref(name));
              }}
              maxHeight={620}
            />
          )}
        </Panel>

        <Panel
          title={field ? `${field.label}, ${dir === "desc" ? "highest" : "lowest"} first` : "Ranking"}
          note={
            filters.length
              ? `${count.data?.total ?? total} of 29 suburbs match the filters.`
              : "The API shows values for the top and bottom five; the rest carry their rank."
          }
          calls={[fields.call, page1.call, page2.call, count.call]}
        >
          {page1.loading ? (
            <Pending height={420} />
          ) : page1.error ? (
            <Failed message={page1.error} />
          ) : !rows.length ? (
            <NoData>No suburb matches those filters.</NoData>
          ) : (
            <ol className="divide-y divide-line text-[14px]">
              {rows.map((r) => (
                <li key={r.suburb} className="grid grid-cols-[28px_1fr_auto] items-baseline gap-2 py-1.5">
                  <span className="text-right font-mono text-[12px] text-faint">{r.rank}</span>
                  <Link href={suburbHref(r.suburb)} className="truncate hover:text-brand-deep">
                    {shortName(r.suburb)}
                  </Link>
                  <span className="font-semibold tabular-nums">{r.value != null ? fmt(r.value) : ""}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
