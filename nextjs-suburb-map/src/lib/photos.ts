/**
 * Sample listing photos. The API's listings carry no photos, so each listing
 * gets one of a dozen free stock photos (Pexels licence: free for commercial
 * use), picked by hashing its GNAF id so the same listing always shows the
 * same photo. Houses get house photos, units get apartment photos. Every place
 * that shows one labels it "Sample photo".
 *
 * The files are self-hosted in public/photos: 1200x800 webp, plus a 640px
 * "-sm" version for cards.
 */

export type StockPhoto = { src: string; srcSmall: string; photographer: string; page: string };

const photo = (file: string, photographer: string, page: string): StockPhoto => ({
  src: `/photos/${file}.webp`,
  srcSmall: `/photos/${file}-sm.webp`,
  photographer,
  page,
});

const HOUSES: StockPhoto[] = [
  photo("house-1", "Jan van der Wolf", "https://www.pexels.com/photo/hedge-by-house-wall-19516616/"),
  photo("house-2", "Max Vakhtbovych", "https://www.pexels.com/photo/yard-of-contemporary-house-with-trees-outside-fence-7031581/"),
  photo("house-3", "Expect Best", "https://www.pexels.com/photo/facade-of-modern-building-against-clear-sky-323781/"),
  photo("house-4", "Max Vakhtbovych", "https://www.pexels.com/photo/courtyard-of-modern-villa-with-glass-walls-7031604/"),
  photo("house-5", "İrem Tuba Orhan", "https://www.pexels.com/photo/terraced-houses-with-triangle-fronts-4927065/"),
  photo("house-6", "Karolina K", "https://www.pexels.com/photo/modern-twin-houses-with-symmetrical-design-30580640/"),
];

const UNITS: StockPhoto[] = [
  photo("unit-1", "Brett Sayles", "https://www.pexels.com/photo/building-with-balconies-11631278/"),
  photo("unit-2", "Mia Vargas", "https://www.pexels.com/photo/apartment-building-against-blue-sky-9308434/"),
  photo("unit-3", "mingche lee", "https://www.pexels.com/photo/modern-apartment-building-with-balconies-39485848/"),
  photo("unit-4", "Zak Chapman", "https://www.pexels.com/photo/living-room-furniture-set-2030037/"),
  photo("unit-5", "Max Vakhtbovych", "https://www.pexels.com/photo/modern-living-room-design-with-corner-sofa-6920439/"),
  photo("unit-6", "Max Vakhtbovych", "https://www.pexels.com/photo/an-interior-of-a-living-room-8089172/"),
];

/** FNV-1a: a small, stable string hash. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The stock photo for a listing: stable per id, house or apartment by type. */
export function stockPhoto(id: string, propertyType?: string | null): StockPhoto {
  const h = hash(id);
  const t = (propertyType ?? "").toLowerCase();
  const set = /house|townhouse|terrace|villa|duplex|semi/.test(t)
    ? HOUSES
    : /unit|apartment|flat|studio/.test(t)
      ? UNITS
      : h % 2
        ? HOUSES
        : UNITS;
  return set[h % set.length];
}
