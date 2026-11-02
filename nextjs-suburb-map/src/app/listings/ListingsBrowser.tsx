"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChoroplethMap, type Marker, RAMPS } from "@/components/ChoroplethMap";
import { NoData } from "@/components/PageShell";
import { ListingCard } from "@/components/listings/ListingCard";
import { type Listing, MODES, type Mode, listingHref, priceLabel } from "@/components/listings/data";
import { shortName } from "@/lib/api";

type Sort = "newest" | "price-asc" | "price-desc";
type Kind = "all" | "house" | "unit";

const HOUSE = /house|townhouse|terrace|villa|semi|duplex/i;
const UNIT = /apartment|studio/i;

const PRICES: Record<Mode, number[]> = {
  buy: [500e3, 750e3, 1e6, 1.25e6, 1.5e6, 2e6, 3e6, 5e6],
  sold: [500e3, 750e3, 1e6, 1.25e6, 1.5e6, 2e6, 3e6, 5e6],
  rent: [400, 500, 600, 750, 900, 1000, 1250, 1500, 2000],
};
const priceOpt = (mode: Mode, n: number) =>
  mode === "rent" ? `$${n.toLocaleString("en-AU")}/wk` : n >= 1e6 ? `$${n / 1e6}m` : `$${n / 1e3}k`;

const PAGE = 24;
const NO_VALUES = new Map<string, number>();
const fmtNone = () => "";

/**
 * Filters, sort and the list/map switch. The server sent every listing for
 * the view; filtering happens here, with no more API calls.
 */
export function ListingsBrowser({
  mode,
  suburb,
  listings,
  total,
  perSuburb,
  failed,
}: {
  mode: Mode;
  suburb: string | null;
  listings: Listing[];
  total: number;
  perSuburb: number | null;
  failed: number;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("all");
  const [beds, setBeds] = useState(-1);
  const [baths, setBaths] = useState(0);
  const [cars, setCars] = useState(0);
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(0);
  const [offOnly, setOffOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<"list" | "map">("list");
  const [shown, setShown] = useState(PAGE);

  const results = useMemo(() => {
    const out = listings.filter(
      (l) =>
        (kind === "all" || (kind === "house" ? HOUSE : UNIT).test(l.type)) &&
        (beds < 0 || (l.beds ?? -1) >= beds) &&
        (!baths || (l.baths ?? 0) >= baths) &&
        (!cars || (l.cars ?? 0) >= cars) &&
        // A price filter hides listings with no price, as portals do.
        (!min || (l.price ?? -1) >= min) &&
        (!max || (l.price != null && l.price <= max)) &&
        (!offOnly || l.offMarket),
    );
    const byPrice = (a: Listing, b: Listing, dir: number) =>
      a.price == null ? 1 : b.price == null ? -1 : (a.price - b.price) * dir;
    return out.sort((a, b) =>
      sort === "newest" ? (b.date ?? "").localeCompare(a.date ?? "") : byPrice(a, b, sort === "price-asc" ? 1 : -1),
    );
  }, [listings, kind, beds, baths, cars, min, max, offOnly, sort]);

  const markers = useMemo<Marker[]>(
    () =>
      results
        .filter((l) => l.lat != null && l.lng != null)
        .map((l) => ({
          id: l.id,
          lat: l.lat!,
          lng: l.lng!,
          label: `${priceLabel(mode, l.price)} · ${l.address}, ${l.suburb}`,
          color: l.offMarket ? "#2dd4bf" : mode === "sold" ? "#ff8a5c" : "#6a92ff",
        })),
    [results, mode],
  );
  const byId = useMemo(() => new Map(results.map((l) => [l.id, l])), [results]);

  const filtered = results.length !== listings.length;
  const reset = () => {
    setKind("all");
    setBeds(-1);
    setBaths(0);
    setCars(0);
    setMin(0);
    setMax(0);
    setOffOnly(false);
  };
  const area = suburb ? shortName(suburb) : "the City of Sydney";

  return (
    <div>
      {/* Filter bar: one row that scrolls sideways on phones. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-2 rounded-2xl border border-line bg-card p-2 shadow-card sm:w-auto sm:flex-wrap">
          <Segmented
            value={kind}
            onChange={(v) => setKind(v as Kind)}
            options={[
              ["all", "All types"],
              ["house", "Houses"],
              ["unit", "Apartments"],
            ]}
          />
          <Select label="Beds" value={beds} onChange={setBeds} options={[[-1, "Any beds"], [0, "Studio+"], [1, "1+ beds"], [2, "2+ beds"], [3, "3+ beds"], [4, "4+ beds"]]} />
          <Select label="Baths" value={baths} onChange={setBaths} options={[[0, "Any baths"], [1, "1+ baths"], [2, "2+ baths"], [3, "3+ baths"]]} />
          {mode !== "sold" && (
            <Select label="Car spaces" value={cars} onChange={setCars} options={[[0, "Any cars"], [1, "1+ cars"], [2, "2+ cars"]]} />
          )}
          <Select
            label="Minimum price"
            value={min}
            onChange={setMin}
            options={[[0, "Min price"], ...PRICES[mode].map((n) => [n, priceOpt(mode, n)] as [number, string])]}
          />
          <Select
            label="Maximum price"
            value={max}
            onChange={setMax}
            options={[[0, "Max price"], ...PRICES[mode].map((n) => [n, priceOpt(mode, n)] as [number, string])]}
          />
          {mode !== "sold" && (
            <button
              type="button"
              aria-pressed={offOnly}
              onClick={() => setOffOnly(!offOnly)}
              className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[14px] transition ${
                offOnly ? "border-accent bg-accent/15 text-ink" : "border-line text-slate hover:text-ink"
              }`}
            >
              Off market only
            </button>
          )}
          {filtered && (
            <button type="button" onClick={reset} className="whitespace-nowrap px-2 text-[13.5px] text-brand-deep hover:underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14.5px] text-slate" aria-live="polite">
          <span className="font-semibold text-ink">{results.length.toLocaleString("en-AU")}</span>
          {filtered ? ` of ${listings.length.toLocaleString("en-AU")}` : ""} {mode === "sold" ? "sales" : `homes ${MODES[mode].noun}`}{" "}
          shown
          <span className="text-faint">
            {" · "}
            {total.toLocaleString("en-AU")} {MODES[mode].noun} in {area}
            {perSuburb ? ` (the newest ${perSuburb} per suburb here; pick a suburb for all of them)` : ""}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <Select
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={[
              ["newest", mode === "sold" ? "Newest sales" : "Newest listings"],
              ["price-asc", "Price: low to high"],
              ["price-desc", "Price: high to low"],
            ]}
          />
          <Segmented
            value={view}
            onChange={(v) => setView(v as "list" | "map")}
            options={[
              ["list", "List"],
              ["map", "Map"],
            ]}
          />
        </div>
      </div>

      {failed > 0 && (
        <p className="mt-3 text-[13.5px] text-warn">
          {failed} suburb feed{failed > 1 ? "s" : ""} did not answer; their listings are missing. Reload to try again.
        </p>
      )}

      {view === "map" && (
        <div className="mt-5">
          <ChoroplethMap
            shapes={[]}
            values={NO_VALUES}
            markers={markers}
            format={fmtNone}
            ramp={RAMPS.blue}
            legend=""
            caption={`${results.length} listings on a map of ${area}`}
            hint="Point at a dot for the price; click it to open the listing."
            onMarkerClick={(id) => {
              const l = byId.get(id);
              if (l) router.push(listingHref(l, mode));
            }}
            maxHeight={620}
            hideLegend
          />
          <div className="mt-2 flex flex-wrap gap-4 text-[12.5px] text-slate">
            <LegendDot color={mode === "sold" ? "#ff8a5c" : "#6a92ff"} label={mode === "sold" ? "Sold" : MODES[mode].noun[0].toUpperCase() + MODES[mode].noun.slice(1)} />
            {mode !== "sold" && <LegendDot color="#2dd4bf" label="Off market" />}
          </div>
        </div>
      )}

      {results.length === 0 ? (
        <div className="mt-6">
          <NoData>
            Nothing matches those filters.{" "}
            <button type="button" onClick={reset} className="text-brand-deep underline">
              Clear them
            </button>
            .
          </NoData>
        </div>
      ) : (
        <>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {results.slice(0, shown).map((l) => (
              <li key={`${l.sal}-${l.id}`}>
                <ListingCard listing={l} mode={mode} href={listingHref(l, mode)} />
              </li>
            ))}
          </ul>
          {results.length > shown && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setShown(shown + PAGE * 2)}
                className="rounded-xl border border-line bg-card px-5 py-2.5 text-[14.5px] font-medium shadow-card hover:border-brand/50"
              >
                Show more ({(results.length - shown).toLocaleString("en-AU")} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="inline-flex shrink-0 rounded-lg bg-ink/[.05] p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[14px] transition ${
            v === value ? "bg-card font-medium text-ink shadow-card" : "text-slate hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Select<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  const active = options[0] && value !== options[0][0];
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          onChange((typeof value === "number" ? Number(raw) : raw) as T);
        }}
        className={`appearance-none rounded-lg border bg-card py-2 pl-3 pr-8 text-[14px] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 ${
          active ? "border-brand/60 text-ink" : "border-line text-slate hover:text-ink"
        }`}
      >
        {options.map(([v, l]) => (
          <option key={String(v)} value={String(v)}>
            {l}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 4.5l3 3 3-3" />
      </svg>
    </label>
  );
}
