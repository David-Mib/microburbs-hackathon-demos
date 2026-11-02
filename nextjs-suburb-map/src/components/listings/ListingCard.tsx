import Link from "next/link";
import { stockPhoto } from "@/lib/photos";
import { type Listing, type Mode, priceLabel, shortDate } from "./data";
import { AreaIcon, BathIcon, BedIcon, CarIcon } from "./Icons";

/**
 * A listing as a photo-first card. `photoUrl` is for real photos if the API
 * ever returns them; until then the card shows a stock "Sample photo".
 */
export function ListingCard({
  listing: l,
  mode,
  href,
  photoUrl,
  compact = false,
}: {
  listing: Listing;
  mode: Mode;
  href: string;
  photoUrl?: string;
  compact?: boolean;
}) {
  const src = photoUrl ?? stockPhoto(l.id, l.type).srcSmall;
  return (
    <Link
      prefetch={false}
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-card transition duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_18px_40px_-20px_rgba(0,0,0,.55)]"
    >
      <div className={`relative overflow-hidden bg-raised ${compact ? "aspect-[16/9]" : "aspect-[3/2]"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="rounded-full bg-card/90 px-2.5 py-1 text-[11.5px] font-semibold text-ink shadow-sm backdrop-blur">
            {l.type}
          </span>
          {l.offMarket && (
            <span className="rounded-full bg-accent px-2.5 py-1 text-[11.5px] font-semibold text-[#04201c] shadow-sm">
              Off market
            </span>
          )}
          {mode === "sold" && (
            <span className="rounded-full bg-warn px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-sm">Sold</span>
          )}
        </div>
        {!photoUrl && <SampleBadge />}
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <div className="text-[19px] font-semibold tracking-[-0.01em]">{priceLabel(mode, l.price)}</div>
        <div className="mt-1 truncate text-[14.5px] text-ink" title={l.address}>
          {l.address}
        </div>
        <div className="text-[13.5px] text-slate">{l.suburb} NSW</div>
        <Features l={l} className="mt-3" />
        {l.date && (
          <div className="mt-3 border-t border-line pt-2.5 text-[12.5px] text-faint">
            {mode === "sold" ? `Sold ${shortDate(l.date)}` : `Listed ${shortDate(l.date)}`}
          </div>
        )}
      </div>
    </Link>
  );
}

export function SampleBadge({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`pointer-events-none absolute bottom-2.5 left-2.5 rounded-md bg-black/60 font-medium uppercase tracking-[.06em] text-white/90 backdrop-blur-sm ${
        large ? "px-2.5 py-1 text-[12px]" : "px-2 py-0.5 text-[10.5px]"
      }`}
    >
      Sample photo
    </span>
  );
}

/** Beds, baths, cars and land, with icons. Studios show "Studio". */
export function Features({ l, className = "", large = false }: { l: Listing; className?: string; large?: boolean }) {
  const items: { icon: React.ReactNode; text: string; label: string }[] = [];
  if (l.beds != null) items.push({ icon: <BedIcon />, text: l.beds === 0 ? "Studio" : String(l.beds), label: "bedrooms" });
  if (l.baths) items.push({ icon: <BathIcon />, text: String(l.baths), label: "bathrooms" });
  if (l.cars) items.push({ icon: <CarIcon />, text: String(l.cars), label: "car spaces" });
  if (l.land != null) items.push({ icon: <AreaIcon />, text: `${Math.round(l.land).toLocaleString("en-AU")} m²`, label: "land" });
  if (!items.length) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate ${large ? "text-[16px]" : "text-[14px]"} ${className}`}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5" title={`${i.text} ${i.label}`}>
          {i.icon}
          <span className="font-medium tabular-nums text-ink">{i.text}</span>
          <span className="sr-only">{i.label}</span>
        </li>
      ))}
    </ul>
  );
}
