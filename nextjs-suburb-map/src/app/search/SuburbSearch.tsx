"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Failed, NoData, PageShell, Panel, Pending } from "@/components/PageShell";
import { shortName, suburbPath } from "@/lib/api";
import { useApi } from "@/lib/api-store";
import { useSuburbList } from "@/lib/area";
import { int, pct } from "@/lib/format";
import { useQueryParam } from "@/lib/use-query-param";

type Match = { area_name: string; information: { state?: string; lga?: string; poa?: string; sa4?: string } };
type Hero = {
  state: string;
  state_abbr: string;
  sa4: string;
  postcode: string;
  population: number;
  dwellings: number;
};
type Narrative = { sentences: Record<string, string> };
type Livability = {
  scores: { key: string; label: string; value: number; level: string }[];
  benchmark: { region: string; scores: Record<string, number> };
};
type AgeRow = { age_bracket: string; gender: string; proportion: number };
type IncomeRow = { income_bracket: string; proportion: number; median_income: number };
type Demographics = { age: AgeRow[]; income: IncomeRow[] };
type Neighbours = { neighbours: { sal: string; sa3: string; dist_km: number }[] };
type Lifestyle = {
  total_pois: number;
  poi_categories: { category: string; count: number }[];
  nearest_train?: { name: string; dist_km: number } | null;
  nearest_shop?: { name: string; dist_km: number } | null;
  nearest_beach_km?: number | null;
  nearest_hospital_km?: number | null;
};

export function SuburbSearch() {
  const [picked, setPicked] = useQueryParam("suburb", "");
  const list = useSuburbList();
  // null until someone types, so a shared ?suburb= link fills the box.
  const [typed, setText] = useState<string | null>(null);
  const text = typed ?? picked;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  // Wait for a pause in typing before asking the API.
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 220);
    return () => clearTimeout(t);
  }, [text]);

  const search = useApi<Match[]>(
    query.length >= 2 && query !== picked ? `/v1/geocode/suburb?q=${encodeURIComponent(query)}` : null,
  );
  const matches = search.data ?? [];
  // Outside the City of Sydney the geocoder answers 200 with data: null and a message.
  const outside = !search.loading && query.length >= 2 && !matches.length ? search.message : null;

  function choose(name: string) {
    setPicked(name);
    setText(name);
    setOpen(false);
  }

  return (
    <PageShell
      slug="search"
      controls={
        <div className="relative max-w-[560px]">
          <label htmlFor="suburb-q" className="text-[14px] font-medium">
            Find a suburb
          </label>
          <input
            id="suburb-q"
            role="combobox"
            aria-expanded={open && matches.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={text}
            placeholder="Start typing, say “surry” or “glebe”"
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, matches.length - 1));
              else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
              else if (e.key === "Enter" && matches[active]) choose(matches[active].area_name);
              else if (e.key === "Escape") setOpen(false);
              else return;
              e.preventDefault();
            }}
            className="mt-1.5 w-full rounded-xl border border-line bg-card px-4 py-3 text-[17px] outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
          {open && matches.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-[0_12px_32px_rgba(15,27,45,.12)]"
            >
              {matches.map((m, i) => (
                <li
                  key={`${m.area_name}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(m.area_name);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 text-[15px] ${
                    i === active ? "bg-brand-wash" : ""
                  }`}
                >
                  <span>
                    {m.area_name}{" "}
                    <span className="text-[13px] text-slate">
                      {m.information.lga}, {m.information.state}
                    </span>
                  </span>
                  {m.information.poa && <span className="shrink-0 font-mono text-[12px] text-faint">{m.information.poa}</span>}
                </li>
              ))}
            </ul>
          )}
          {open && outside && <p className="mt-2 text-[13px] text-warn">{outside}</p>}
          <p className="mt-2 text-[13px] leading-[1.6] text-slate">
            The hackathon key covers the {list.names.length || 29} suburbs of the City of Sydney:{" "}
            {list.names.map((n, i) => (
              <span key={n}>
                <button type="button" className="text-brand-deep hover:underline" onClick={() => choose(n)}>
                  {shortName(n)}
                </button>
                {i < list.names.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
        </div>
      }
    >
      {!picked ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-[15px] text-slate">
          Pick a suburb to see its snapshot.
        </p>
      ) : (
        <Snapshot key={picked} suburb={picked} onPick={choose} />
      )}
    </PageShell>
  );
}

function Snapshot({ suburb, onPick }: { suburb: string; onPick: (name: string) => void }) {
  const hero = useApi<Hero>(suburbPath(suburb, "hero/summary"));
  const narrative = useApi<Narrative>(suburbPath(suburb, "lifestyle/narrative"));
  const liv = useApi<Livability>(suburbPath(suburb, "lifestyle/livability"));
  const life = useApi<Lifestyle>(suburbPath(suburb, "lifestyle/summary"));
  const demo = useApi<Demographics>(suburbPath(suburb, "demographics/all"));
  const neighbours = useApi<Neighbours>(suburbPath(suburb, "hero/neighbours"));
  const label = shortName(suburb);
  const area = new Set(useSuburbList().names);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Panel title={label} calls={[hero.call]} className="lg:col-span-5">
        {hero.loading ? (
          <Pending height={70} />
        ) : hero.error ? (
          <Failed message={hero.error} />
        ) : hero.data ? (
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <Fact label="State" value={hero.data.state} />
            <Fact label="Region" value={hero.data.sa4} />
            <Fact label="Postcode" value={hero.data.postcode} />
            <Fact label="Residents" value={int(hero.data.population)} />
            <Fact label="Dwellings" value={int(hero.data.dwellings)} />
          </dl>
        ) : (
          <NoData />
        )}
      </Panel>

      <Panel
        title="Livability"
        note={liv.data ? `Out of 100. The tick is the average for ${liv.data.benchmark.region}.` : undefined}
        calls={[liv.call]}
        className="lg:col-span-2"
      >
        {liv.loading ? (
          <Pending height={240} />
        ) : liv.error ? (
          <Failed message={liv.error} />
        ) : (
          <ul className="grid gap-3">
            {liv.data?.scores.map((s) => {
              const bench = liv.data!.benchmark.scores[s.key];
              return (
                <li key={s.key}>
                  <div className="flex justify-between text-[14px]">
                    <span>{s.label}</span>
                    <span className="tabular-nums">
                      <span className="font-semibold">{s.value}</span> <span className="text-slate">{s.level}</span>
                    </span>
                  </div>
                  <div className="relative mt-1 h-2 rounded-full bg-ink/[.06]">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${s.value}%` }} />
                    {bench != null && (
                      <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `${bench}%` }} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="What it is like" calls={[narrative.call]} className="lg:col-span-3">
        {narrative.loading ? (
          <Pending height={240} />
        ) : narrative.error ? (
          <Failed message={narrative.error} />
        ) : (
          <dl className="grid gap-3">
            {Object.entries(narrative.data?.sentences ?? {}).map(([k, v]) => (
              <div key={k} className="grid gap-0.5 sm:grid-cols-[110px_1fr] sm:gap-4">
                <dt className="text-[14px] font-semibold">{k[0].toUpperCase() + k.slice(1)}</dt>
                <dd className="text-[15px] leading-[1.5] text-slate">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      <Panel title="Around the suburb" calls={[life.call]} className="lg:col-span-5">
        {life.loading ? (
          <Pending height={120} />
        ) : life.error ? (
          <Failed message={life.error} />
        ) : life.data ? (
          <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Fact label="Nearest train" value={life.data.nearest_train ? `${life.data.nearest_train.dist_km} km` : "None close"} />
              <Fact label="Nearest supermarket" value={life.data.nearest_shop ? `${life.data.nearest_shop.dist_km} km` : "None close"} />
              <Fact label="Beach" value={life.data.nearest_beach_km != null ? `${life.data.nearest_beach_km} km` : "None close"} />
              <Fact label="Hospital" value={life.data.nearest_hospital_km != null ? `${life.data.nearest_hospital_km} km` : "None close"} />
            </dl>
            <div>
              <div className="text-[13px] text-slate">{int(life.data.total_pois)} places, by kind</div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {life.data.poi_categories.slice(0, 10).map((c) => (
                  <li key={c.category} className="rounded-full bg-ink/[.05] px-3 py-1 text-[13px]">
                    {c.category} <span className="font-semibold tabular-nums">{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <NoData />
        )}
      </Panel>

      <Panel title="Who lives here" note="Census 2021: share of residents by age, and households by yearly income." calls={[demo.call]} className="lg:col-span-3">
        {demo.loading ? (
          <Pending height={220} />
        ) : demo.error ? (
          <Failed message={demo.error} />
        ) : !demo.data ? (
          <NoData />
        ) : (
          <Demography data={demo.data} />
        )}
      </Panel>

      <Panel title="Next door" note="Neighbouring suburbs by distance." calls={[neighbours.call]} className="lg:col-span-2">
        {neighbours.loading ? (
          <Pending height={220} />
        ) : neighbours.error ? (
          <Failed message={neighbours.error} />
        ) : (
          <ul className="divide-y divide-line text-[14px]">
            {(neighbours.data?.neighbours ?? []).slice(0, 8).map((n) => {
              const exact = [...area].find((a) => shortName(a) === n.sal || a === n.sal);
              return (
                <li key={n.sal} className="flex items-baseline justify-between gap-3 py-2">
                  {exact ? (
                    <button type="button" className="font-medium text-brand-deep hover:underline" onClick={() => onPick(exact)}>
                      {n.sal}
                    </button>
                  ) : (
                    <span>
                      {n.sal} <span className="text-[12px] text-faint">outside the area</span>
                    </span>
                  )}
                  <span className="tabular-nums text-slate">{n.dist_km} km</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="flex flex-wrap gap-2 lg:col-span-5">
        {[
          ["Market dashboard", "market"],
          ["Crime and safety", "crime"],
          ["Block map", "map"],
        ].map(([name, slug]) => (
          <Link
            key={slug}
            href={`/${slug}?suburb=${encodeURIComponent(suburb)}`}
            className="rounded-lg border border-line bg-card px-4 py-2 text-[14px] font-medium hover:border-ink/40"
          >
            {name} for {label} →
          </Link>
        ))}
      </div>
    </div>
  );
}

const AGE_ORDER = ["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55+"];

/** Age as horizontal bars (persons), income brackets as a stacked bar. */
function Demography({ data }: { data: Demographics }) {
  const persons = new Map(data.age.filter((r) => r.gender === "persons").map((r) => [r.age_bracket, r.proportion]));
  const max = Math.max(...persons.values(), 0.01);
  const income = [...data.income].reverse();
  const shades = ["#e3eafb", "#b3c7f4", "#7d9eec", "#4475e6", "#2447a8"];
  return (
    <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
      <ul className="grid gap-1">
        {AGE_ORDER.filter((a) => persons.has(a)).map((a) => (
          <li key={a} className="grid grid-cols-[48px_1fr_44px] items-center gap-2 text-[12.5px]">
            <span className="text-slate">{a}</span>
            <span className="h-3 rounded-sm bg-brand" style={{ width: `${(persons.get(a)! / max) * 100}%` }} />
            <span className="text-right tabular-nums">{pct(persons.get(a), 0)}</span>
          </li>
        ))}
      </ul>
      <div>
        <div className="text-[13px] text-slate">
          Household income, median {income[0] ? `$${int(income[0].median_income)}` : "–"} a year
        </div>
        <div className="mt-2 flex h-4 overflow-hidden rounded-full">
          {income.map((r, i) => (
            <span key={r.income_bracket} style={{ width: `${r.proportion * 100}%`, background: shades[i] }} />
          ))}
        </div>
        <ul className="mt-3 grid gap-1 text-[13px]">
          {income.map((r, i) => (
            <li key={r.income_bracket} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: shades[i] }} />
                {r.income_bracket}
              </span>
              <span className="tabular-nums">{pct(r.proportion, 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-slate">{label}</dt>
      <dd className="text-[16px] font-semibold">{value}</dd>
    </div>
  );
}
