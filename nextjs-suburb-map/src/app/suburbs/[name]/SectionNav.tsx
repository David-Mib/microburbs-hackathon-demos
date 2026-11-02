"use client";

import { useEffect, useState } from "react";

export const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "market", label: "Market" },
  { id: "safety", label: "Safety" },
  { id: "risks", label: "Risks" },
  { id: "development", label: "Development" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "people", label: "People" },
  { id: "nearby", label: "Nearby" },
];

/** Sticky in-page nav that follows the section on screen. */
export function SectionNav() {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    // Sections stream in; look for them again as they arrive.
    const watch = () => SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <nav
      aria-label="Report sections"
      className="sticky top-16 z-20 -mx-4 mb-8 border-b border-line bg-paper/85 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:mr-0"
    >
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={`block whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13.5px] transition ${
                active === s.id ? "bg-ink text-on-ink" : "text-slate hover:bg-ink/5 hover:text-ink"
              }`}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
