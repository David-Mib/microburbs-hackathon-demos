"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DOCS_URL } from "@/lib/api";
import { DEMOS } from "@/lib/pages";

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 h-[65px] border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          <Mark />
          <span className="whitespace-nowrap text-[16px] font-semibold tracking-[-0.01em]">
            Microburbs <span className="font-normal text-slate">City of Sydney</span>
          </span>
        </Link>

        <nav aria-label="Demos" className="hidden min-w-0 flex-1 items-center gap-1 xl:flex">
          {DEMOS.map((d) => {
            const active = path?.startsWith(`/${d.slug}`);
            return (
              <Link
                key={d.slug}
                href={`/${d.slug}`}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[14px] ${
                  active ? "bg-ink text-white" : "text-slate hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {d.nav}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap rounded-md bg-brand px-3 py-1.5 text-[14px] font-medium text-white hover:bg-brand-deep"
          >
            API docs
          </a>
          <button
            type="button"
            className="rounded-md px-2 py-1.5 text-[14px] text-slate hover:text-ink xl:hidden"
            aria-expanded={open}
            aria-controls="demo-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? "Close" : "Demos"}
          </button>
        </div>
      </div>

      {open && (
        <nav id="demo-menu" aria-label="Demos" className="border-b border-line bg-paper px-4 pb-4 pt-2 xl:hidden">
          {DEMOS.map((d) => (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2.5 text-[16px] hover:bg-ink/5"
            >
              {d.name}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

/** A 3×3 grid of blocks, one lit: a suburb seen at microburb grain. */
function Mark() {
  const lit = [4];
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <rect
          key={i}
          x={(i % 3) * 7.5}
          y={Math.floor(i / 3) * 7.5}
          width="6.5"
          height="6.5"
          rx="1.2"
          fill={lit.includes(i) ? "var(--color-brand)" : "var(--color-ink)"}
          opacity={lit.includes(i) ? 1 : 0.85 - (i % 4) * 0.15}
        />
      ))}
    </svg>
  );
}
