"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_API_BASE } from "./api";

/**
 * One page's log of API calls. Every panel asks for a path; the store makes
 * the request once (same path = same call), keeps the response and the
 * details the request inspector shows, and tells React when anything moves.
 *
 * Requests go to this app's own route, /api/mb/v1/..., never straight to the
 * API: the route adds the team key on the server.
 */

export type Call = {
  id: number;
  /** The API path, e.g. /v1/suburbs/Surry%20Hills/market/all */
  path: string;
  state: "pending" | "done" | "error";
  /** The URL the server called (no key in it). */
  url: string;
  status?: number;
  /** How long the API took. */
  ms?: number;
  /** True when this app answered from its own cache. */
  cached?: boolean;
  requestId?: string | null;
  size?: number;
  body?: unknown;
  error?: string;
};

type Snapshot = { calls: Call[]; selected: number | null; sheetOpen: boolean };

const MAX_IN_FLIGHT = 6;
const EMPTY: Snapshot = { calls: [], selected: null, sheetOpen: false };

class ApiStore {
  private snap: Snapshot = EMPTY;
  private byPath = new Map<string, number>();
  private listeners = new Set<() => void>();
  private queue: (() => void)[] = [];
  private inFlight = 0;
  private nextId = 1;
  /** Once someone picks a call, stop following the newest one. */
  private picked = false;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;
  getServerSnapshot = () => EMPTY;

  private set(next: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...next };
    for (const fn of this.listeners) fn();
  }

  private patch(id: number, patch: Partial<Call>) {
    this.set({ calls: this.snap.calls.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  }

  select = (id: number | null, openSheet = false) => {
    this.picked = true;
    this.set({ selected: id, sheetOpen: openSheet || this.snap.sheetOpen });
  };
  setSheet = (open: boolean) => this.set({ sheetOpen: open });

  /** Start `path` unless it has already been asked for. Returns its call id. */
  ensure = (path: string): number => {
    const existing = this.byPath.get(path);
    if (existing) return existing;
    const id = this.nextId++;
    this.byPath.set(path, id);
    this.set({
      calls: [{ id, path, state: "pending", url: DEFAULT_API_BASE + path }, ...this.snap.calls],
      selected: this.picked ? this.snap.selected : id,
    });
    this.queue.push(() => void this.run(id, path));
    this.pump();
    return id;
  };

  private pump() {
    while (this.inFlight < MAX_IN_FLIGHT && this.queue.length) {
      this.inFlight++;
      this.queue.shift()!();
    }
  }

  private async run(id: number, path: string) {
    try {
      const res = await fetch(`/api/mb${path}`);
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* non-JSON error body: keep the text */
      }
      this.patch(id, {
        state: res.ok ? "done" : "error",
        status: res.status,
        url: res.headers.get("x-upstream-url") ?? DEFAULT_API_BASE + path,
        ms: Number(res.headers.get("x-upstream-ms") ?? 0),
        cached: res.headers.get("x-cache") === "HIT",
        requestId: res.headers.get("x-request-id"),
        size: new TextEncoder().encode(text).length,
        body,
        error: res.ok ? undefined : errorDetail(body, res.status),
      });
    } catch {
      this.patch(id, { state: "error", error: "The app's server could not be reached. Is `npm run dev` still running?" });
    } finally {
      this.inFlight--;
      this.pump();
    }
  }
}

function errorDetail(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (d && typeof d === "object" && "message" in d) return String((d as { message: unknown }).message);
  }
  if (status === 401) return "The API refused the key (401). Check MICROBURBS_API_KEY in .env.local.";
  if (status === 403) return "Outside the hackathon area (403): only the 29 City of Sydney suburbs answer.";
  if (status === 429) return "Too many requests (429). Wait a moment and reload.";
  return `The API answered ${status}.`;
}

const Ctx = createContext<ApiStore | null>(null);

function Provider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => new ApiStore());
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** One call log per page: a new route starts a fresh store. */
export function ApiProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <Provider key={path}>{children}</Provider>;
}

function useStore() {
  const store = useContext(Ctx);
  if (!store) throw new Error("useApi needs an <ApiProvider>");
  return store;
}

export function useApiLog() {
  const store = useStore();
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...snap, select: store.select, setSheet: store.setSheet };
}

export type ApiResult<T> = {
  data: T | null;
  call: Call | undefined;
  loading: boolean;
  error: string | null;
  /** The API's explanation when it answered 200 with `data: null`. */
  message: string | null;
};

/**
 * Ask for `path` (null = nothing yet) and read the envelope's `data`.
 * The API answers `{ data }`, or `{ data: null, available: false, message }`
 * when it simply has no figure — both are 200.
 */
export function useApi<T>(path: string | null): ApiResult<T> {
  const store = useStore();
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const hydrated = useHydrated();
  useEffect(() => {
    if (path && hydrated) store.ensure(path);
  }, [path, hydrated, store]);
  return toResult<T>(snap.calls, path);
}

/** The same for a list of paths (one per suburb, say). */
export function useApis<T>(paths: string[]): ApiResult<T>[] {
  const store = useStore();
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const key = paths.join("\n");
  const hydrated = useHydrated();
  useEffect(() => {
    if (hydrated) for (const p of key.split("\n")) if (p) store.ensure(p);
  }, [key, hydrated, store]);
  return paths.map((p) => toResult<T>(snap.calls, p));
}

/**
 * False during the hydration render, true after. Some views read the query
 * string, which the prerendered HTML does not have, so we wait one render and
 * only call the API for what the URL actually asks for.
 */
const noop = () => () => {};
function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

function toResult<T>(calls: Call[], path: string | null): ApiResult<T> {
  const call = path ? calls.find((c) => c.path === path) : undefined;
  const loading = !!path && (!call || call.state === "pending");
  const body =
    call?.state === "done" ? (call.body as { data?: T; message?: string } | undefined) : undefined;
  return {
    data: (body?.data ?? null) as T | null,
    call,
    loading,
    error: call?.state === "error" ? (call.error ?? "Request failed") : null,
    message: body && body.data == null ? (body.message ?? "The API has no figure for this.") : null,
  };
}
