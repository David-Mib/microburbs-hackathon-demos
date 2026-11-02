"use client";

import { useSyncExternalStore } from "react";

/**
 * Dark by default; light is a toggle. The choice lives in localStorage and as
 * the `dark` class on <html>, which an inline script in layout.tsx applies
 * before first paint (so there is no flash of the wrong theme).
 */
export type Theme = "dark" | "light";
export const THEME_KEY = "theme";

export const API_PANEL_KEY = "api-panel";

/**
 * Runs in <head> before React: keeps a stored "light" choice, and a closed
 * API-calls panel (data-api="closed" on <html>; the CSS hides the panel).
 */
export const THEME_SCRIPT = `try{var d=document.documentElement;if(localStorage.getItem("${THEME_KEY}")==="light")d.classList.remove("dark");if(localStorage.getItem("${API_PANEL_KEY}")==="closed")d.dataset.api="closed"}catch(e){}`;

function subscribe(fn: () => void) {
  const obs = new MutationObserver(fn);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-api"] });
  return () => obs.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "dark",
  );
}

export function setTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
}

/** Is the API-calls panel open? Remembered across pages and visits. */
export function useApiPanelOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.api !== "closed",
    () => true,
  );
}

export function setApiPanelOpen(open: boolean) {
  if (open) delete document.documentElement.dataset.api;
  else document.documentElement.dataset.api = "closed";
  try {
    localStorage.setItem(API_PANEL_KEY, open ? "open" : "closed");
  } catch {
    /* private mode */
  }
}
