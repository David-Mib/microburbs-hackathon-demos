import type { Metadata } from "next";
import Link from "next/link";
import type { Marker } from "@/components/ChoroplethMap";
import { NoData, PageShell } from "@/components/PageShell";
import { Features, ListingCard, SampleBadge } from "@/components/listings/ListingCard";
import {
  type FeedBody,
  type Listing,
  MODES,
  type Mode,
  fromFeed,
  isMode,
  listingHref,
  priceLabel,
  shortDate,
  titleCase,
  typeLabel,
} from "@/components/listings/data";
import { type SuburbListItem, propertyPath, shortName, suburbHref, suburbPath } from "@/lib/api";
import { ServerCalls } from "@/lib/api-store";
import { metres, money } from "@/lib/format";
import { stockPhoto } from "@/lib/photos";
import { api } from "@/lib/server/microburbs";
import { LocationMap } from "./LocationMap";

export const revalidate = 3600;

type Params = { gnaf: string };
type Search = { suburb?: string; mode?: string };

type Avm = { predicted_price: number; predicted_price_low: number; predicted_price_high: number; confidence_score: number; prediction_date: string };
type Basics = { bed_count: number | null; bath_count: number | null; parking_count: number | null; dwelling_type: string | null; land_area_sqm: number | null };
type School = { id: number; name: string; sector: string; school_level_type: string; distance_m: number };
type Stop = { name?: string; label: string; lat: number; lng: number; distance_m: number } | null;
type Transport = { center_lat?: number; center_lng?: number; radius_m: number; counts: Record<string, number>; nearest: Record<string, Stop> };
type Risk = { name: string; value: string; on_property: boolean; nearest_distance_m: number | null };
type Risks = Record<string, Risk[] | null>;
type Sale = { address: string; gnaf_pid: string; price: number; date_sold: string; dist_km: number; property_type: string; bedrooms?: number; bathrooms?: number; latitude: number; longitude: number };
type Profile = { suburb?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const sp = await searchParams;
  return { title: sp.suburb ? `Listing in ${shortName(sp.suburb)}` : "Listing" };
}

export default async function Page({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { gnaf } = await params;
  const sp = await searchParams;
  const mode: Mode = isMode(sp.mode) ? sp.mode : "buy";
  const p = (tail: string) => propertyPath(gnaf, tail);

  // The suburb comes in the link; without it, ask the property profile.
  const calls = [];
  let sal = sp.suburb ?? null;
  if (!sal) {
    const [profile, list] = await Promise.all([api<Profile>(p("profile")), api<SuburbListItem[]>("/v1/suburbs/list")]);
    calls.push(profile.call, list.call);
    const bare = profile.data?.suburb;
    sal = list.data?.find((s) => s.suburb === bare || shortName(s.suburb) === bare)?.suburb ?? bare ?? null;
  }

  // Everything else at once.
  const feedPath = sal
    ? `${suburbPath(sal, MODES[mode].tail)}?limit=200${mode === "sold" ? "" : "&verbose=true"}`
    : null;
  const [feed, avm, basics, schools, transport, risks, sales] = await Promise.all([
    feedPath ? api<FeedBody>(feedPath) : null,
    api<Avm>(p("valuation/avm")),
    api<Basics>(p("basics/all")),
    api<School[]>(p("schools/nearby")),
    api<Transport>(p("transport/nearby")),
    api<Risks>(p("risks/all")),
    api<Sale[]>(p("comparables/recent-sales-nearby")),
  ]);
  for (const r of [feed, avm, basics, schools, transport, risks, sales]) if (r) calls.push(r.call);

  const all = sal ? fromFeed(mode, sal, feed?.data ?? null).listings : [];
  const found = all.find((l) => l.id === gnaf);

  // Not in the live feed: one more call for the street address.
  let streetAddress: string | null = null;
  if (!found) {
    const street = await api<{ address?: string }>(p("street/profile"));
    calls.push(street.call);
    streetAddress = street.data?.address ?? null;
  }

  const b = basics.data;
  // Off the feed (sold long ago, or no longer listed): fall back to the property basics.
  const l: Listing = found ?? {
    id: gnaf,
    address: streetAddress ?? `Property ${gnaf}`,
    suburb: sal ? shortName(sal) : "",
    sal: sal ?? "",
    lat: transport.data?.center_lat ?? null,
    lng: transport.data?.center_lng ?? null,
    price: null,
    beds: b?.bed_count ?? null,
    baths: b?.bath_count ?? null,
    cars: b?.parking_count ?? null,
    land: b?.land_area_sqm ?? null,
    building: null,
    type: typeLabel(b?.dwelling_type),
    date: null,
    offMarket: false,
  };
  const photo = stockPhoto(l.id, l.type);
  const more = all.filter((x) => x.id !== gnaf).slice(0, 3);

  const markers: Marker[] = [
    ...(sales.data ?? []).slice(0, 12).map((s) => ({
      id: s.gnaf_pid,
      lat: s.latitude,
      lng: s.longitude,
      label: `Sold ${money(s.price)} · ${titleCase(s.address)} · ${shortDate(s.date_sold)}`,
      tone: "dot" as const,
    })),
    ...(l.lat != null && l.lng != null ? [{ id: l.id, lat: l.lat, lng: l.lng, label: `${l.address} · ${priceLabel(mode, l.price)}`, tone: "focus" as const }] : []),
  ];
  const links: Record<string, string> = {};
  for (const s of sales.data ?? []) if (sal) links[s.gnaf_pid] = `/listings/${encodeURIComponent(s.gnaf_pid)}?suburb=${encodeURIComponent(sal)}&mode=sold`;

  return (
    <PageShell
      slug="listings"
      eyebrow={
        <span className="normal-case tracking-normal">
          <Link href={`/listings?mode=${mode}`} className="hover:text-ink">
            Listings
          </Link>
          {sal && (
            <>
              {" / "}
              <Link href={`/listings?mode=${mode}&suburb=${encodeURIComponent(sal)}`} className="hover:text-ink">
                {shortName(sal)}
              </Link>
            </>
          )}
        </span>
      }
      title=""
      intro=""
      endpoints={[
        `/suburbs/{name}/${MODES[mode].tail}`,
        "/properties/{gnaf_id}/valuation/avm",
        "/properties/{gnaf_id}/basics/all",
        "/properties/{gnaf_id}/schools/nearby",
        "/properties/{gnaf_id}/transport/nearby",
        "/properties/{gnaf_id}/risks/all",
        "/properties/{gnaf_id}/comparables/recent-sales-nearby",
      ]}
      hero={<div />}
    >
      <ServerCalls calls={calls} />

      {/* Photo and the headline card. */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-[260px] overflow-hidden rounded-3xl border border-line bg-raised shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt="" className="aspect-[3/2] h-full w-full object-cover xl:absolute xl:inset-0 xl:aspect-auto" />
          <div className="absolute left-4 top-4 flex gap-2">
            <span className="rounded-full bg-card/90 px-3 py-1 text-[12.5px] font-semibold shadow-sm backdrop-blur">{l.type}</span>
            {l.offMarket && <span className="rounded-full bg-accent px-3 py-1 text-[12.5px] font-semibold text-[#04201c]">Off market</span>}
            {mode === "sold" && <span className="rounded-full bg-warn px-3 py-1 text-[12.5px] font-semibold text-white">Sold</span>}
          </div>
          <SampleBadge large />
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
            <div className="text-[13px] font-medium uppercase tracking-[.08em] text-faint">
              {!found ? "Property" : mode === "sold" ? "Sold" : mode === "buy" ? "For sale" : "For rent"}
            </div>
            <div className="mt-1 text-[30px] font-semibold leading-tight tracking-[-0.02em]">
              {found ? priceLabel(mode, l.price) : `Not ${mode === "sold" ? "recently sold" : `listed ${MODES[mode].noun}`}`}
            </div>
            <h1 className="mt-2 text-[18px] font-medium leading-snug">{l.address}</h1>
            <div className="text-[15px] text-slate">{l.suburb} NSW</div>
            <Features l={l} large className="mt-4" />
            {l.date && (
              <div className="mt-4 border-t border-line pt-3 text-[13.5px] text-slate">
                {mode === "sold" ? "Sold" : "Listed"} {shortDate(l.date)}
                {!found && " · no longer in the live feed"}
              </div>
            )}
            {!found && !l.date && (
              <div className="mt-4 border-t border-line pt-3 text-[13.5px] text-slate">
                This home is not in {l.suburb || "the suburb"}&apos;s current {MODES[mode].noun} feed; the figures below still
                apply to the property.
              </div>
            )}
          </div>

          <Estimate avm={avm.data} mode={mode} message={avm.message} />

          <div className="grid grid-cols-2 gap-2">
            {sal && (
              <Link prefetch={false} href={suburbHref(sal)} className="rounded-xl border border-line bg-card px-3 py-2.5 text-center text-[14px] font-medium shadow-card hover:border-brand/50">
                {shortName(sal)} report
              </Link>
            )}
            <Link href={`/property?gnaf=${encodeURIComponent(gnaf)}`} className="rounded-xl border border-line bg-card px-3 py-2.5 text-center text-[14px] font-medium shadow-card hover:border-brand/50">
              Property profile
            </Link>
          </div>
        </aside>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 grid-cols-1 gap-6">
          <Card title="About this home">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[14.5px] sm:grid-cols-3">
              <Fact label="Type" value={l.type} />
              <Fact label="Bedrooms" value={l.beds == null ? "–" : l.beds === 0 ? "Studio" : l.beds} />
              <Fact label="Bathrooms" value={l.baths ?? "–"} />
              <Fact label="Car spaces" value={l.cars ?? "–"} />
              <Fact label="Land" value={l.land != null ? `${Math.round(l.land).toLocaleString("en-AU")} m²` : "–"} />
              <Fact label="Building" value={l.building != null ? `${Math.round(l.building).toLocaleString("en-AU")} m²` : "–"} />
            </dl>
            {l.description ? (
              <div className="mt-5 whitespace-pre-line border-t border-line pt-5 text-[15px] leading-[1.65] text-slate">{l.description}</div>
            ) : (
              mode !== "sold" && <p className="mt-5 border-t border-line pt-5 text-[14px] text-faint">The agent&apos;s description isn&apos;t in the feed for this one.</p>
            )}
          </Card>

          <Card title="Location" note="This home in orange; recent sales nearby as dots (click one to open it).">
            {markers.length ? <LocationMap markers={markers} links={links} /> : <NoData>No coordinates for this listing.</NoData>}
          </Card>

          <Card title="Recent sales nearby" note="Closest sales of the last few months, from comparables/recent-sales-nearby.">
            {sales.data?.length ? (
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full text-[14px] sm:min-w-[520px]">
                  <thead>
                    <tr className="text-left text-[12.5px] text-faint">
                      <th className="px-1 py-2 font-medium">Address</th>
                      <th className="hidden px-1 py-2 font-medium sm:table-cell">Type</th>
                      <th className="hidden px-1 py-2 text-right font-medium sm:table-cell">Beds</th>
                      <th className="px-1 py-2 text-right font-medium">Price</th>
                      <th className="px-1 py-2 text-right font-medium">Sold</th>
                      <th className="px-1 py-2 text-right font-medium">Away</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.data.slice(0, 8).map((s) => (
                      <tr key={s.gnaf_pid} className="border-t border-line">
                        <td className="px-1 py-2.5">
                          {links[s.gnaf_pid] ? (
                            <Link href={links[s.gnaf_pid]} className="hover:text-brand-deep">
                              {titleCase(s.address)}
                            </Link>
                          ) : (
                            titleCase(s.address)
                          )}
                        </td>
                        <td className="hidden px-1 py-2.5 text-slate sm:table-cell">{typeLabel(s.property_type)}</td>
                        <td className="hidden px-1 py-2.5 text-right tabular-nums text-slate sm:table-cell">{s.bedrooms ?? "–"}</td>
                        <td className="whitespace-nowrap px-1 py-2.5 text-right font-semibold">{money(s.price)}</td>
                        <td className="whitespace-nowrap px-1 py-2.5 text-right tabular-nums text-slate">{shortDate(s.date_sold)}</td>
                        <td className="whitespace-nowrap px-1 py-2.5 text-right tabular-nums text-slate">{metres(s.dist_km * 1000)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <NoData>{sales.message ?? "No recent sales nearby."}</NoData>
            )}
          </Card>
        </div>

        <div className="grid min-w-0 grid-cols-1 content-start gap-6">
          <Card title="Getting around">
            <TransportBlock t={transport.data} />
          </Card>
          <Card title="Schools nearby">
            {schools.data?.length ? (
              <ul className="grid grid-cols-1 gap-2.5">
                {schools.data.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 text-[14px]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{s.name}</div>
                      <div className="text-[12.5px] text-faint">
                        {s.school_level_type} ·{" "}
                        <span className={s.sector === "public" ? "text-ok-deep" : "text-brand-deep"}>{titleCase(s.sector)}</span>
                      </div>
                    </div>
                    <span className="shrink-0 tabular-nums text-slate">{metres(s.distance_m)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <NoData>{schools.message ?? "No schools listed nearby."}</NoData>
            )}
          </Card>
          <Card title="Hazards and overlays">
            <RiskBlock risks={risks.data} />
          </Card>
        </div>
      </div>

      {more.length > 0 && sal && (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
              More {mode === "sold" ? "sales" : `homes ${MODES[mode].noun}`} in {shortName(sal)}
            </h2>
            <Link href={`/listings?mode=${mode}&suburb=${encodeURIComponent(sal)}`} className="whitespace-nowrap text-[14px] text-brand-deep hover:underline">
              See all →
            </Link>
          </div>
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {more.map((x) => (
              <li key={x.id}>
                <ListingCard listing={x} mode={mode} href={listingHref(x, mode)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-[12.5px] leading-5 text-faint">
        Photos are sample stock images, not this property: photo by{" "}
        <a href={photo.page} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-slate">
          {photo.photographer} on Pexels
        </a>
        . Listing details, the estimate and everything else on this page come from the Microburbs API.
      </p>
    </PageShell>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>
      {note && <p className="mt-1 text-[13.5px] text-slate">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12.5px] text-faint">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** The AVM estimate with its range, as a bar. */
function Estimate({ avm, mode, message }: { avm: Avm | null; mode: Mode; message: string | null }) {
  return (
    <div className="rounded-2xl border border-line bg-gradient-to-br from-brand-wash to-card p-5 shadow-card">
      <div className="text-[13px] font-medium text-brand-deep">Microburbs estimate</div>
      {avm ? (
        <>
          <div className="mt-1 text-[26px] font-semibold tracking-[-0.02em]">{money(avm.predicted_price)}</div>
          <div className="mt-3 h-2 rounded-full bg-gradient-to-r from-brand/25 via-brand to-brand/25" />
          <div className="mt-1.5 flex justify-between text-[12.5px] tabular-nums text-slate">
            <span>{money(avm.predicted_price_low)}</span>
            <span>{money(avm.predicted_price_high)}</span>
          </div>
          <p className="mt-3 text-[12.5px] leading-5 text-faint">
            Modelled value{mode === "rent" ? " to buy" : ""}, confidence {avm.confidence_score}/100, as of {shortDate(avm.prediction_date)}. From
            valuation/avm.
          </p>
        </>
      ) : (
        <p className="mt-2 text-[14px] text-slate">{message ?? "No estimate for this property."}</p>
      )}
    </div>
  );
}

function TransportBlock({ t }: { t: Transport | null }) {
  if (!t) return <NoData>No transport data.</NoData>;
  const rows = (["train", "tram", "bus", "ferry"] as const).filter((k) => t.nearest[k] || t.counts[k]);
  if (!rows.length) return <NoData>No stops within {metres(t.radius_m)}.</NoData>;
  return (
    <ul className="grid grid-cols-1 gap-3 text-[14px]">
      {rows.map((k) => {
        const n = t.nearest[k];
        return (
          <li key={k} className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium capitalize">{k}</div>
              <div className="truncate text-[12.5px] text-faint">
                {n?.name ?? n?.label ?? "None nearby"} · {t.counts[k] ?? 0} stops within {metres(t.radius_m)}
              </div>
            </div>
            <span className="shrink-0 tabular-nums text-slate">{n ? metres(n.distance_m) : "–"}</span>
          </li>
        );
      })}
    </ul>
  );
}

const RISK_LABELS: Record<string, string> = {
  flood: "Flood",
  historical_flood: "Past flooding",
  bushfire: "Bushfire",
  heritage: "Heritage",
  hv_power_line: "High-voltage lines",
  landslide: "Landslide",
  erosion: "Erosion",
  environment: "Environmental",
  mobile_black_spot: "Mobile black spot",
};

function RiskBlock({ risks }: { risks: Risks | null }) {
  if (!risks) return <NoData>No hazard data.</NoData>;
  const rows = Object.entries(RISK_LABELS).map(([k, label]) => {
    const first = risks[k]?.[0];
    return { k, label, first };
  });
  return (
    <ul className="grid grid-cols-1 gap-2.5 text-[14px]">
      {rows.map(({ k, label, first }) => {
        const on = first?.on_property;
        return (
          <li key={k} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${on ? "bg-warn" : first ? "bg-faint" : "bg-ok"}`} />
              {label}
            </span>
            <span className={`text-right text-[13px] ${on ? "font-medium text-warn" : "text-slate"}`}>
              {on ? "On the property" : first?.nearest_distance_m != null ? `${metres(first.nearest_distance_m)} away` : "None nearby"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
