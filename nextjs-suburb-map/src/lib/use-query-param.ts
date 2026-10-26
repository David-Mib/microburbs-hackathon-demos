"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A single `?key=value` in the URL as state, so a view (map layer, sort
 * order) can be shared as a link. Reads the browser's location and falls back
 * to `fallback` during prerender, which has no query string.
 */
const EVENT = "querychange";

function subscribe(fn: () => void) {
  window.addEventListener("popstate", fn);
  window.addEventListener(EVENT, fn);
  return () => {
    window.removeEventListener("popstate", fn);
    window.removeEventListener(EVENT, fn);
  };
}

export function useQueryParam(key: string, fallback: string, allowed?: string[]) {
  const raw = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(key),
    () => null,
  );
  const value = raw && (!allowed || allowed.includes(raw)) ? raw : fallback;

  const set = useCallback(
    (next: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set(key, next);
      window.history.replaceState(null, "", url);
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, set] as const;
}
