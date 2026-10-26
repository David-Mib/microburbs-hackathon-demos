"use client";

import { useEffect, useMemo, useState } from "react";
import { DOCS_URL, KEY_PLACEHOLDER, asCurl, asFetch, asPython, safeDecode } from "@/lib/api";
import { type Call, useApiLog } from "@/lib/api-store";
import { bytes } from "@/lib/format";

/**
 * The request panel. Sticky on the right on desktop; a sheet behind the
 * "API calls" bar on phones. Lists every API call the page made, and for the
 * selected one shows the upstream URL, status, timing, the JSON response, and
 * the same request as curl, JavaScript or Python with the key replaced by
 * YOUR_TEAM_KEY.
 */
export function Inspector() {
  const { calls, selected, select, sheetOpen, setSheet } = useApiLog();
  const current = calls.find((c) => c.id === selected) ?? calls[0];
  const pending = calls.filter((c) => c.state === "pending").length;
  const cached = calls.filter((c) => c.cached).length;

  // Lock page scroll while the phone sheet is open.
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const panel = (
    <div className="flex h-full min-h-0 flex-col bg-wire text-wire-ink">
      <div className="flex items-baseline justify-between gap-3 border-b border-wire-line px-5 py-4">
        <h2 className="text-[15px] font-semibold text-white">
          API calls <span className="font-normal text-wire-dim">{calls.length}</span>
        </h2>
        <span className="text-[12.5px] text-wire-dim" aria-live="polite">
          {pending
            ? `${pending} in flight`
            : calls.length
              ? `All returned${cached ? `, ${cached} from cache` : ""}`
              : "Waiting"}
        </span>
        <button
          type="button"
          className="-mr-1 rounded px-2 py-1 text-[13px] text-wire-dim hover:text-white lg:hidden"
          onClick={() => setSheet(false)}
        >
          Close
        </button>
      </div>

      <ol className="max-h-[32%] shrink-0 overflow-y-auto border-b border-wire-line py-1 font-mono text-[12px]">
        {calls.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => select(c.id)}
              aria-current={c.id === current?.id}
              className={`grid w-full grid-cols-[10px_1fr_auto] items-center gap-2.5 px-5 py-1.5 text-left hover:bg-white/5 ${
                c.id === current?.id ? "bg-white/[.07] text-white" : ""
              }`}
            >
              <StatusDot call={c} />
              <span className="truncate" title={safeDecode(c.path)}>
                {safeDecode(c.path.replace(/^\/v1/, ""))}
              </span>
              <span className="tabular-nums text-wire-dim">{timing(c)}</span>
            </button>
          </li>
        ))}
      </ol>

      {current ? <CallDetail key={current.id} call={current} /> : <Empty />}
    </div>
  );

  return (
    <>
      <aside
        aria-label="API calls"
        className="sticky top-[65px] hidden h-[calc(100dvh-65px)] border-l border-line lg:block"
      >
        {panel}
      </aside>

      {/* Phones and tablets: a bar that opens the same panel as a sheet. */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between rounded-xl bg-wire px-4 py-3 text-left text-white shadow-[0_8px_30px_rgba(15,27,45,.35)]"
        >
          <span className="text-[14px] font-semibold">See the API calls</span>
          <span className="font-mono text-[12px] text-wire-dim">
            {pending ? `${pending} in flight` : `${calls.length} returned`}
          </span>
        </button>
        {sheetOpen && (
          <div className="fixed inset-0 z-40 flex flex-col bg-ink/40" role="dialog" aria-modal="true" aria-label="API calls">
            <div className="mt-10 min-h-0 flex-1 overflow-hidden rounded-t-2xl">{panel}</div>
          </div>
        )}
      </div>
    </>
  );
}

const timing = (c: Call) => (c.state === "pending" ? "…" : c.cached ? "cached" : c.ms ? `${c.ms} ms` : "");

function StatusDot({ call }: { call: Call }) {
  const color =
    call.state === "pending" ? "bg-wire-dim animate-pulse" : call.state === "done" ? "bg-ok" : "bg-bad";
  return <span className={`h-2 w-2 rounded-full ${color}`} aria-label={call.state} />;
}

function Empty() {
  return <p className="px-5 py-6 text-[14px] text-wire-dim">Calls appear here as the page makes them.</p>;
}

type Lang = "curl" | "js" | "python";
const LANGS: { key: Lang; label: string; make: (url: string) => string }[] = [
  { key: "curl", label: "curl", make: asCurl },
  { key: "js", label: "JavaScript", make: asFetch },
  { key: "python", label: "Python", make: asPython },
];

function CallDetail({ call }: { call: Call }) {
  const [lang, setLang] = useState<Lang>("curl");
  const snippet = LANGS.find((l) => l.key === lang)!.make(call.url);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-4 lg:pb-6">
      <p className="break-all font-mono text-[12px] leading-5 text-white">
        <span className="mr-2 rounded bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white">GET</span>
        {safeDecode(call.url)}
      </p>
      <p className="mt-1.5 font-mono text-[11.5px] text-wire-dim">
        Authorization: Bearer <span className="text-json-num">{KEY_PLACEHOLDER}</span>
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 text-[12px]">
        <Meta label="Status" value={call.status ?? (call.state === "pending" ? "…" : "failed")} tone={call.state} />
        <Meta label="API time" value={call.ms ? `${call.ms} ms` : call.state === "pending" ? "…" : "–"} />
        <Meta label="Size" value={call.size != null ? bytes(call.size) : "…"} />
        <Meta label="Served from" value={call.state === "pending" ? "…" : call.cached ? "app cache" : "the API"} />
        {call.requestId && (
          <div className="col-span-2">
            <dt className="text-wire-dim">X-Request-Id</dt>
            <dd className="mt-0.5 truncate font-mono text-wire-ink">{call.requestId}</dd>
          </div>
        )}
      </dl>

      <div className="mt-5 rounded-lg border border-wire-line">
        <div className="flex items-center border-b border-wire-line text-[12px]">
          {LANGS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLang(l.key)}
              className={`px-3 py-2 ${lang === l.key ? "text-white shadow-[inset_0_-2px_0_var(--color-brand)]" : "text-wire-dim hover:text-white"}`}
            >
              {l.label}
            </button>
          ))}
          <div className="ml-auto flex gap-1 pr-1.5">
            <CopyButton text={asCurl(call.url)} label="Copy curl" />
            <CopyButton text={asFetch(call.url)} label="Copy fetch" />
          </div>
        </div>
        <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-5 text-wire-ink">{snippet}</pre>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-wire-dim">
        This page called the app&apos;s own <code className="text-wire-ink">/api/mb</code> route, which made this request
        on the server with the team key. Swap <code className="text-wire-ink">{KEY_PLACEHOLDER}</code> for yours to run
        it yourself.{" "}
        <a className="text-white underline decoration-brand underline-offset-2" href={DOCS_URL} target="_blank" rel="noreferrer">
          API reference
        </a>
      </p>

      <h3 className="mt-6 text-[13px] font-semibold text-white">Response</h3>
      {call.state === "pending" ? (
        <p className="mt-2 text-[13px] text-wire-dim">Waiting for the API…</p>
      ) : (
        <>
          {call.error && <p className="mt-2 text-[13px] leading-5 text-bad-soft">{call.error}</p>}
          {call.body !== undefined && <JsonView value={call.body} />}
        </>
      )}
    </div>
  );
}

function Meta({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Call["state"] }) {
  return (
    <div>
      <dt className="text-wire-dim">{label}</dt>
      <dd
        className={`mt-0.5 font-mono tabular-nums ${tone === "done" ? "text-ok" : tone === "error" ? "text-bad-soft" : "text-wire-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
}

export function CopyButton({ text, label, dark = true }: { text: string; label: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API blocked (plain http, iframe): fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded-md px-2 py-1 text-[12px] font-medium ${
        dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-ink/5 text-ink hover:bg-ink/10"
      }`}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

const LINE_CAP = 200;

/** Pretty JSON with light syntax colour. Long bodies show the first lines. */
function JsonView({ value }: { value: unknown }) {
  const [all, setAll] = useState(false);
  const lines = useMemo(
    () => (typeof value === "string" ? value : JSON.stringify(value, null, 2)).split("\n"),
    [value],
  );
  const shown = all ? lines : lines.slice(0, LINE_CAP);
  return (
    <div className="mt-2 rounded-lg bg-black/25">
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-5">
        {shown.map((l, i) => (
          <div key={i}>{highlight(l)}</div>
        ))}
      </pre>
      {lines.length > LINE_CAP && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="w-full border-t border-wire-line px-3 py-2 text-left text-[12px] text-wire-dim hover:text-white"
        >
          {all ? "Show fewer lines" : `Show all ${lines.length.toLocaleString("en-AU")} lines`}
        </button>
      )}
    </div>
  );
}

const TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function highlight(line: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(line.slice(last, i));
    if (m[1] && m[2]) {
      out.push(
        <span key={i} className="text-json-key">
          {m[1]}
        </span>,
        m[2],
      );
    } else if (m[1]) {
      out.push(
        <span key={i} className="text-json-str">
          {m[1]}
        </span>,
      );
    } else if (m[3]) {
      out.push(
        <span key={i} className="text-json-lit">
          {m[3]}
        </span>,
      );
    } else {
      out.push(
        <span key={i} className="text-json-num">
          {m[4]}
        </span>,
      );
    }
    last = i + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
