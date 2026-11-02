import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/PageShell";
import { type FeedBody, type Listing, MODES, type Mode, fromFeed, isMode } from "@/components/listings/data";
import { type SuburbListItem, shortName, suburbPath } from "@/lib/api";
import { ServerCalls } from "@/lib/api-store";
import { api } from "@/lib/server/microburbs";
import { ListingsBrowser } from "./ListingsBrowser";
import { ListingsNav } from "./ListingsNav";
import { ResultsGhost } from "./ResultsGhost";

export const metadata: Metadata = { title: "Listings" };

/** API answers are cached for an hour (see lib/server/microburbs.ts). */
export const revalidate = 3600;

/** With "All City of Sydney" we take the newest N from each suburb's feed. */
const PER_SUBURB = 24;
const ONE_SUBURB = 200;

type Search = { mode?: string; suburb?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const mode: Mode = isMode(sp.mode) ? sp.mode : "buy";
  const list = await api<SuburbListItem[]>("/v1/suburbs/list");
  const names = list.data?.map((s) => s.suburb) ?? [];
  const suburb = sp.suburb && names.includes(sp.suburb) ? sp.suburb : null;

  return (
    <PageShell
      slug="listings"
      eyebrow="City of Sydney"
      title={
        <>
          {mode === "buy" ? "Homes for sale" : mode === "rent" ? "Homes for rent" : "Recently sold"}
          {suburb ? <span className="text-slate"> in {shortName(suburb)}</span> : null}
        </>
      }
      intro="Every listing in the City of Sydney's 29 suburbs, straight from the API: for sale, for rent and sold in the last three years."
      hero={<ListingsNav mode={mode} suburb={suburb} names={names} />}
    >
      <ServerCalls calls={[list.call]} />
      {/* A new mode or suburb streams in behind ghost cards; the header stays put. */}
      <Suspense key={`${mode}|${suburb}`} fallback={<ResultsGhost />}>
        <Results mode={mode} suburb={suburb} names={names} />
      </Suspense>
    </PageShell>
  );
}

async function Results({ mode, suburb, names }: { mode: Mode; suburb: string | null; names: string[] }) {
  const targets = suburb ? [suburb] : names;
  const limit = suburb ? ONE_SUBURB : PER_SUBURB;
  // One call per suburb, all at once.
  const feeds = await Promise.all(targets.map((n) => api<FeedBody>(`${suburbPath(n, MODES[mode].tail)}?limit=${limit}`)));

  let total = 0;
  const listings: Listing[] = [];
  feeds.forEach((f, i) => {
    const r = fromFeed(mode, targets[i], f.data);
    total += r.total;
    listings.push(...r.listings);
  });
  // The cards never show the agent's description, so don't send it.
  for (const l of listings) delete l.description;

  return (
    <>
      <ServerCalls calls={feeds.map((f) => f.call)} />
      <ListingsBrowser
        key={`${mode}|${suburb}`}
        mode={mode}
        suburb={suburb}
        listings={listings}
        total={total}
        perSuburb={suburb ? null : PER_SUBURB}
        failed={feeds.filter((f) => f.call.status !== 200).length}
      />
    </>
  );
}
