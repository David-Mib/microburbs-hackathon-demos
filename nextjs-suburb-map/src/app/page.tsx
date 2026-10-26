import Link from "next/link";
import { DOCS_URL, EXAMPLE_PROPERTY, KEY_PLACEHOLDER } from "@/lib/api";
import { DEMOS, MORE_DEMOS } from "@/lib/pages";

/** The index: every demo in the app, and how they reach the API. */
export default function Home() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-24 sm:px-6">
      <section className="grid items-center gap-10 pb-12 pt-10 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div>
          <div className="mb-3 text-[13px] font-medium uppercase tracking-[.08em] text-brand-deep">
            Microburbs Hackathon API
          </div>
          <h1 className="text-[40px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[56px]">
            The City of Sydney, block by block
          </h1>
          <p className="mt-5 max-w-[36em] text-[18px] leading-[1.55] text-slate">
            {DEMOS.length} small products built on the hackathon API, covering all 29 suburbs of the City of Sydney and
            every address in them. Each page shows the calls it makes: the URL, the JSON that came back, and the same
            request as curl, JavaScript or Python, ready to paste.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/city" className="rounded-lg bg-ink px-4 py-2.5 text-[15px] font-medium text-white hover:bg-ink/85">
              Open the city map
            </Link>
            <Link
              href={`/property?gnaf=${EXAMPLE_PROPERTY.gnaf}`}
              className="rounded-lg border border-ink/15 bg-card px-4 py-2.5 text-[15px] font-medium hover:border-ink/40"
            >
              Look up {EXAMPLE_PROPERTY.address}
            </Link>
          </div>
        </div>

        <figure className="rounded-2xl bg-wire px-6 py-6 text-wire-ink">
          <figcaption className="text-[15px] font-semibold text-white">How every page gets its data</figcaption>
          <ol className="mt-4 grid gap-3 font-mono text-[12.5px] leading-5">
            <li className="rounded-lg bg-white/[.06] px-3 py-2.5">
              <span className="text-wire-dim">1. Browser</span>
              <br />
              GET <span className="text-json-str">/api/mb/v1/suburbs/Surry%20Hills/crime/summary</span>
            </li>
            <li className="rounded-lg bg-white/[.06] px-3 py-2.5">
              <span className="text-wire-dim">2. This app&apos;s route handler, on the server</span>
              <br />
              GET <span className="text-json-str">https://api-ht.microburbs.com.au/v1/suburbs/…</span>
              <br />
              Authorization: Bearer <span className="text-json-num">{KEY_PLACEHOLDER}</span>
            </li>
            <li className="rounded-lg bg-white/[.06] px-3 py-2.5">
              <span className="text-wire-dim">3. Back to the browser, unchanged</span>
              <br />
              {"{ "}
              <span className="text-json-key">&quot;data&quot;</span>: {"{ "}
              <span className="text-json-key">&quot;verdict&quot;</span>: <span className="text-json-str">&quot;High&quot;</span>, …{" } }"}
            </li>
          </ol>
          <p className="mt-4 text-[13px] leading-5 text-wire-dim">
            The key lives in <code className="text-wire-ink">.env.local</code> and never reaches the browser. The server
            also caches answers for an hour and keeps under the API&apos;s rate limit.
          </p>
        </figure>
      </section>

      <section aria-labelledby="demos" className="border-t border-line pt-10">
        <h2 id="demos" className="text-[26px] font-semibold tracking-[-0.02em]">
          The demos
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {DEMOS.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/${d.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-line bg-card px-6 py-5 hover:border-ink/30"
              >
                <h3 className="flex items-center gap-2 text-[21px] font-semibold tracking-[-0.015em] group-hover:text-brand-deep">
                  {d.name}
                  {d.isNew && (
                    <span className="rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-medium text-brand-deep">New</span>
                  )}
                </h3>
                <p className="mt-1.5 max-w-[50ch] flex-1 text-[15.5px] leading-[1.5] text-slate">{d.pitch}</p>
                <p className="mt-3 font-mono text-[12px] leading-5 text-faint">
                  {d.endpoints.length} endpoints, starting with {d.endpoints[0]}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="more" className="mt-12 border-t border-line pt-10">
        <h2 id="more" className="text-[26px] font-semibold tracking-[-0.02em]">
          More demos
        </h2>
        <p className="mt-2 text-[15px] text-slate">The same API from other stacks.</p>
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {MORE_DEMOS.map((d) => (
            <li key={d.name}>
              <a href={d.href} className="group block rounded-2xl border border-dashed border-line px-6 py-5 hover:border-ink/30">
                <h3 className="text-[19px] font-semibold group-hover:text-brand-deep">{d.name}</h3>
                <p className="mt-1 text-[15px] leading-[1.5] text-slate">{d.pitch}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-2xl bg-brand-wash px-6 py-6 sm:px-8">
        <h2 className="text-[20px] font-semibold">Build your own</h2>
        <p className="mt-2 max-w-[70ch] text-[15px] leading-[1.6] text-slate">
          Everything here is one route handler (<code className="font-mono text-ink">src/app/api/mb</code>) plus plain
          React. Copy a page, change the endpoint, and the request inspector shows you what came back. The full list of
          endpoints, with a &ldquo;Test request&rdquo; button on each, is in the{" "}
          <a href={DOCS_URL} target="_blank" rel="noreferrer" className="text-brand-deep underline underline-offset-2">
            API reference
          </a>
          .
        </p>
      </section>
    </main>
  );
}
