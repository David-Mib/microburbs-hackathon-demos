import Link from "next/link";
import { NewBadge } from "@/components/SiteHeader";
import { UniversalSearch } from "@/components/UniversalSearch";
import { DOCS_URL, KEY_PLACEHOLDER, suburbHref } from "@/lib/api";
import { DEMOS, MAIN_NAV, MORE_DEMOS, MORE_NAV } from "@/lib/pages";

const QUICK = [
  { label: "Surry Hills", href: suburbHref("Surry Hills") },
  { label: "Glebe", href: suburbHref("Glebe (NSW)") },
  { label: "Redfern", href: suburbHref("Redfern") },
  { label: "26 Tudor Street, Surry Hills", href: "/property?gnaf=GANSW705970502" },
];

const STATS = [
  { value: "29", label: "suburbs in the City of Sydney" },
  { value: "2,215", label: "mesh blocks, each with its own figures" },
  { value: "Every", label: "address, with valuation and history" },
  { value: "170+", label: "endpoints in the hackathon API" },
];

/** Screenshots of each product for the homepage cards: public/home/<slug>-dark.webp and -light.webp. */
const shot = (slug: string) => `/home/${slug}`;

export default function Home() {
  const [reports, listings, heat, crime, property] = ["suburbs", "listings", "heatmaps", "crime", "property"].map(
    (s) => MAIN_NAV.find((d) => d.slug === s)!,
  );
  return (
    <main>
      {/* Hero */}
      {/* z-10 and no overflow clip on the section: the search dropdown has to hang over the stats band below. */}
      <section className="relative isolate z-10 border-b border-line">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="hero-glow absolute inset-0" />
          <div className="grid-fade absolute inset-0" />
        </div>
        <div className="mx-auto max-w-[1100px] px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3.5 py-1.5 text-[13px] text-slate backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Microburbs Hackathon API · City of Sydney
          </div>
          <h1 className="mx-auto mt-6 max-w-[20ch] text-[44px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[72px]">
            Every suburb. Every address. <span className="text-gradient">Block by block.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[58ch] text-[17px] leading-[1.6] text-slate sm:text-[19px]">
            Suburb reports, a listings portal, heat maps and property profiles, all built on one API. Every page shows
            the calls behind it, ready to copy.
          </p>
          <div className="mx-auto mt-9 max-w-[720px]">
            <UniversalSearch />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[13.5px]">
            <span className="text-faint">Try</span>
            {QUICK.map((q) => (
              <Link
                key={q.href}
                prefetch={false}
                href={q.href}
                className="rounded-full border border-line bg-card/60 px-3 py-1 text-slate transition hover:border-brand/50 hover:text-ink"
              >
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-line bg-card/40">
        <dl className="mx-auto grid max-w-[1280px] grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="px-2 text-center md:border-l md:border-line md:first:border-l-0">
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-[34px] font-semibold tracking-[-0.03em]">{s.value}</dd>
              <dd className="mt-1 text-[13.5px] text-slate">{s.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-[1280px] px-4 pt-20 sm:px-6" aria-labelledby="explore">
        <SectionHead
          id="explore"
          eyebrow="Explore"
          title="Five products, one API"
          sub="Each one is a working page you can open, use and copy. Pick a suburb, an address or a metric and go."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-6">
          <ProductCard demo={reports} className="lg:col-span-4" image={shot("suburbs")} tall />
          <ProductCard demo={listings} className="lg:col-span-2" image={shot("listings")} tall />
          <ProductCard demo={heat} className="lg:col-span-2" image={shot("heatmaps")} />
          <ProductCard demo={crime} className="lg:col-span-2" image={shot("crime")} />
          <ProductCard demo={property} className="lg:col-span-2" image={shot("property")} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MORE_NAV.map((d) => (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              className="group rounded-2xl border border-line bg-card px-5 py-4 transition hover:-translate-y-0.5 hover:border-brand/40"
            >
              <div className="flex items-center justify-between text-[15.5px] font-semibold">
                {d.name}
                <span className="text-faint transition group-hover:translate-x-0.5 group-hover:text-brand-deep">→</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[13.5px] leading-[1.5] text-slate">{d.pitch}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* For developers */}
      <section className="mx-auto mt-24 max-w-[1280px] px-4 sm:px-6" aria-labelledby="devs">
        <div className="grid items-center gap-10 rounded-3xl border border-line bg-card p-6 shadow-card sm:p-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHead
              id="devs"
              eyebrow="For hackathon teams"
              title="See every call. Copy any of them."
              sub="Each page has an API panel listing the calls it made: the URL, status, timing and the JSON that came back, with the same request as curl, JavaScript or Python. Hide it when you just want the product."
              align="left"
            />
            <ul className="mt-6 grid gap-3 text-[15px] text-slate">
              {[
                "The key stays on the server: pages call this app, the app calls the API.",
                "Answers are cached at the edge for an hour, so pages load fast and the rate limit lasts.",
                `${DEMOS.length} pages, plain React and Next.js. Copy one, change the endpoint, done.`,
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={DOCS_URL} target="_blank" rel="noreferrer" className="rounded-xl bg-brand px-4 py-2.5 text-[15px] font-medium text-white transition hover:brightness-110">
                Read the API reference
              </a>
              <Link href="/suburbs" className="rounded-xl border border-line px-4 py-2.5 text-[15px] font-medium transition hover:border-brand/50">
                Open a suburb report
              </Link>
            </div>
          </div>
          <figure className="overflow-hidden rounded-2xl border border-wire-line bg-wire text-wire-ink shadow-card">
            <div className="flex items-center gap-1.5 border-b border-wire-line px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="ml-3 font-mono text-[12px] text-wire-dim">app/suburbs/[name]/page.tsx</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6">
              <span className="text-json-lit">const</span> [summary, crime] = <span className="text-json-lit">await</span> Promise.all([{"\n"}
              {"  "}api(<span className="text-json-str">&quot;/v1/suburbs/Surry%20Hills/hero/summary&quot;</span>),{"\n"}
              {"  "}api(<span className="text-json-str">&quot;/v1/suburbs/Surry%20Hills/crime/summary&quot;</span>),{"\n"}
              ]);{"\n\n"}
              <span className="text-wire-dim">{"// on the server, with Authorization: Bearer "}{KEY_PLACEHOLDER}</span>
              {"\n"}crime.data{"  "}
              <span className="text-wire-dim">{"// → { "}</span>
              <span className="text-json-key">verdict</span>
              <span className="text-wire-dim">: </span>
              <span className="text-json-str">&quot;High&quot;</span>
              <span className="text-wire-dim">, </span>
              <span className="text-json-key">vs_national_pct</span>
              <span className="text-wire-dim">: </span>
              <span className="text-json-num">336</span>
              <span className="text-wire-dim">{" }"}</span>
            </pre>
          </figure>
        </div>
      </section>

      {/* More demos */}
      <section className="mx-auto mt-24 max-w-[1280px] px-4 sm:px-6" aria-labelledby="more">
        <SectionHead id="more" eyebrow="Other stacks" title="More demos" sub="The same API from Python." />
        <div className="mx-auto mt-8 grid max-w-[960px] gap-5 md:grid-cols-2">
          {MORE_DEMOS.map((d) => (
            <a
              key={d.name}
              href={d.href}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col rounded-2xl border border-line bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:border-brand/40"
            >
              <h3 className="text-[19px] font-semibold tracking-[-0.015em]">{d.name}</h3>
              <p className="mt-1.5 flex-1 text-[15px] leading-[1.55] text-slate">{d.pitch}</p>
              <span className="mt-4 text-[14px] font-medium text-brand-deep">
                {d.cta} <span className="inline-block transition group-hover:translate-x-0.5">↗</span>
              </span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

function SectionHead({
  id,
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  id: string;
  eyebrow: string;
  title: string;
  sub: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-[680px] text-center" : ""}>
      <div className="text-[13px] font-medium uppercase tracking-[.1em] text-brand-deep">{eyebrow}</div>
      <h2 id={id} className="mt-2 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
        {title}
      </h2>
      <p className="mt-3 text-[16px] leading-[1.6] text-slate">{sub}</p>
    </div>
  );
}

function ProductCard({
  demo,
  image,
  className = "",
  tall = false,
}: {
  demo: (typeof DEMOS)[number];
  image: string;
  className?: string;
  tall?: boolean;
}) {
  return (
    <Link
      href={`/${demo.slug}`}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-card transition hover:-translate-y-1 hover:border-brand/40 ${className}`}
    >
      <div className="p-6 pb-4">
        <h3 className="flex items-center gap-2 text-[21px] font-semibold tracking-[-0.02em]">
          {demo.name}
          {demo.isNew && <NewBadge />}
        </h3>
        <p className="mt-1.5 max-w-[56ch] text-[14.5px] leading-[1.55] text-slate">{demo.pitch}</p>
      </div>
      <div className={`relative mx-6 mt-auto overflow-hidden rounded-t-xl border border-b-0 border-line bg-raised ${tall ? "h-[300px]" : "h-[190px]"}`}>
        {/* One screenshot per theme; CSS shows the one that matches. */}
        {(["dark", "light"] as const).map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t}
            src={`${image}-${t}.webp`}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover object-left-top transition duration-500 group-hover:scale-[1.02] ${
              t === "dark" ? "hidden dark:block" : "dark:hidden"
            }`}
          />
        ))}
      </div>
    </Link>
  );
}
