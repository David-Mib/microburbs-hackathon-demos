"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DOCS_URL } from "@/lib/api";
import { MAIN_NAV, MORE_NAV } from "@/lib/pages";
import { setTheme, useTheme } from "@/lib/theme";
import { SearchPalette } from "./SearchPalette";

export function SiteHeader() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const isActive = (slug: string) => path === `/${slug}` || path.startsWith(`/${slug}/`);

  // Close the phone menu on navigation.
  useEffect(() => setOpen(false), [path]);

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-line bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1680px] items-center gap-5 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Microburbs API demos, home">
          <Logo />
          <span className="whitespace-nowrap text-[16px] font-semibold tracking-[-0.015em]">
            Microburbs<span className="ml-1.5 hidden font-normal text-slate sm:inline">API demos</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex">
          {MAIN_NAV.map((d) => (
            <NavLink key={d.slug} href={`/${d.slug}`} active={isActive(d.slug)}>
              {d.nav}
            </NavLink>
          ))}
          <MoreMenu active={MORE_NAV.some((d) => isActive(d.slug))} isActive={isActive} />
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {path !== "/" && <SearchPalette />}
          <ThemeToggle />
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden whitespace-nowrap rounded-lg bg-brand px-3.5 py-2 text-[14px] font-medium text-white shadow-[0_6px_20px_-8px_var(--brand)] transition hover:brightness-110 sm:inline-block"
          >
            API docs
          </a>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate hover:bg-ink/5 hover:text-ink lg:hidden"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav id="site-menu" aria-label="Main" className="border-b border-line bg-paper px-4 pb-5 pt-2 shadow-card lg:hidden">
          {[...MAIN_NAV, ...MORE_NAV].map((d) => (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-[16px] ${
                isActive(d.slug) ? "bg-brand-wash text-brand-deep" : "hover:bg-ink/5"
              }`}
            >
              {d.name}
              {d.isNew && <NewBadge />}
            </Link>
          ))}
          <a href={DOCS_URL} target="_blank" rel="noreferrer" className="mt-2 block rounded-lg px-3 py-2.5 text-[16px] text-brand-deep">
            API docs ↗
          </a>
        </nav>
      )}
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`whitespace-nowrap rounded-lg px-3 py-2 text-[14px] transition ${
        active ? "bg-ink/[.07] font-medium text-ink" : "text-slate hover:bg-ink/5 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function MoreMenu({ active, isActive }: { active: boolean; isActive: (slug: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-lg px-3 py-2 text-[14px] transition ${
          active ? "bg-ink/[.07] font-medium text-ink" : "text-slate hover:bg-ink/5 hover:text-ink"
        }`}
      >
        More
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" className={open ? "rotate-180" : ""}>
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-11 w-[320px] rounded-xl border border-line bg-card p-1.5 shadow-card fade-up">
          {MORE_NAV.map((d) => (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 ${isActive(d.slug) ? "bg-brand-wash" : "hover:bg-ink/5"}`}
            >
              <div className="text-[14px] font-medium text-ink">{d.name}</div>
              <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-[1.4] text-slate">{d.pitch}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewBadge() {
  return <span className="rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-medium text-brand-deep">New</span>;
}

function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="grid h-9 w-9 place-items-center rounded-lg text-slate transition hover:bg-ink/5 hover:text-ink"
    >
      {theme === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" />
        </svg>
      )}
    </button>
  );
}

/** The Microburbs mark (the house-and-continent from our logo). */
export function Logo({ size = 26 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/mark.svg" width={size} height={size} alt="" aria-hidden="true" />;
}
