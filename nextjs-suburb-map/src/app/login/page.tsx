import type { Metadata } from "next";
import { safeNext } from "@/lib/server/gate";

export const metadata: Metadata = { title: "Enter your password" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto max-w-[440px] px-4 pb-24 pt-20 sm:px-6">
      <h1 className="text-[32px] font-semibold tracking-[-0.03em]">Enter your password</h1>
      <p className="mt-2 text-slate">If you don&apos;t have one yet, wait for one to be shared with you.</p>
      <form method="post" action="/api/login" className="mt-8 flex gap-2">
        <input type="hidden" name="next" value={safeNext(next)} />
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2.5 text-ink outline-none focus:border-brand"
        />
        <button type="submit" className="rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-deep">
          Enter
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-bad">That password didn&apos;t work.</p> : null}
    </main>
  );
}
