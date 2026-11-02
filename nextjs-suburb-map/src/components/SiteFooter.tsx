import Link from "next/link";
import { DOCS_URL } from "@/lib/api";
import { DEMOS, MORE_DEMOS } from "@/lib/pages";
import { Logo } from "./SiteHeader";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto grid max-w-[1680px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[16px] font-semibold">Microburbs API demos</span>
          </div>
          <p className="mt-3 max-w-[44ch] text-[14px] leading-[1.6] text-slate">
            Built on the Microburbs Hackathon API: every suburb and address in the City of Sydney. Data is
            modelled and for demonstration; listing photos are sample stock images.
          </p>
        </div>
        <div>
          <h2 className="text-[13px] font-medium uppercase tracking-[.08em] text-faint">Demos</h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
            {DEMOS.map((d) => (
              <li key={d.slug}>
                <Link href={`/${d.slug}`} className="text-slate hover:text-ink">
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-[13px] font-medium uppercase tracking-[.08em] text-faint">Developers</h2>
          <ul className="mt-3 grid gap-2 text-[14px]">
            <li>
              <a href={DOCS_URL} target="_blank" rel="noreferrer" className="text-slate hover:text-ink">
                API reference ↗
              </a>
            </li>
            {MORE_DEMOS.map((d) => (
              <li key={d.name}>
                <a href={d.href} target="_blank" rel="noreferrer" className="text-slate hover:text-ink">
                  {d.name} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1680px] flex-wrap justify-between gap-2 px-4 py-5 text-[12.5px] text-faint sm:px-6">
          <span>© {new Date().getFullYear()} Microburbs. Demo site for the hackathon.</span>
          <span>Maps © OpenFreeMap, OpenMapTiles, OpenStreetMap contributors</span>
        </div>
      </div>
    </footer>
  );
}
