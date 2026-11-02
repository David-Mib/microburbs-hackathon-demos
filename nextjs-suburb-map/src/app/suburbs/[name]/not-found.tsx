import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-24 text-center">
      <p className="text-[13px] font-medium uppercase tracking-[.12em] text-brand-deep">Suburb report</p>
      <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.03em]">No report for that suburb</h1>
      <p className="mt-3 text-[16px] text-slate">The demo covers the 29 suburbs of the City of Sydney.</p>
      <Link href="/suburbs" className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 text-[15px] font-medium text-white">
        See all 29 suburbs
      </Link>
    </main>
  );
}
