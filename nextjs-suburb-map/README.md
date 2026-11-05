# Microburbs API demos (Next.js)

A Next.js app (App Router, TypeScript) built on the Microburbs Hackathon API. It covers all 29 suburbs of the
City of Sydney and every address in them: suburb reports, a listings portal, heat maps, crime, property profiles
and more. Dark mode by default with a light toggle; every map sits on a real base map.

Every page has an **API calls** panel beside it (hide it and it stays hidden until you reopen it). It lists the
calls the page made: the URL, the status, how long it took and the JSON that came back, and the same request as
curl, JavaScript or Python.

Live: <https://microburbs-api-demos.vercel.app>

| Page | What it shows |
|------|---------------|
| `/` | Universal search: type a suburb or an address, go straight to its page (`suburbs/list`, `geocode/suburb`, `geocode/address`) |
| `/suburbs`, `/suburbs/{name}` | A one-page report per suburb: market, prices and rents over time, demographics, crime, schools, lifestyle, risks, development |
| `/listings`, `/listings/{gnaf_id}` | For sale, for rent and sold, with filters, a map view and a page per listing (`listings/for-sale`, `listings/for-rent`, `sales/recent`, property endpoints) |
| `/heatmaps` | The whole city as heat maps: ancestry and birthplace by suburb, income, prices, rents, yields, vacancy, livability and crime by block |
| `/crime` | A suburb against the national crime rate, the offences behind it, and the rate block by block |
| `/property` | Any address: valuation and range, value over time, its street, history, nearby sales, hazards, transport, schools |
| `/market` | Price, rent, yield and vacancy history for houses and units, growth, the forecast range and the latest sales |
| `/compare` | All 29 suburbs in one sortable table |
| `/finder` | Rank the suburbs on any of 46 fields, filter by ranges, see the ranking on a map |
| `/map` | Every block of one suburb on any layer |

Suburb endpoints are `/v1/suburbs/{name}/...` and property endpoints are `/v1/properties/{gnaf_id}/...`. The
full reference is at <https://api-ht.microburbs.com.au/docs>.

## Two ways a page gets data

- **On the server** (suburb reports, listings): the page is a server component that calls
  `api(path)` from [`src/lib/server/microburbs.ts`](src/lib/server/microburbs.ts), fetching in parallel with
  `Promise.all`, and renders complete HTML. `export const revalidate = 3600` caches the rendered page for an
  hour. It hands the call records to `<ServerCalls calls={...} />` so the API panel can list them.
- **In the browser** (maps you switch between, search as you type): a client component calls `useApi(path)`,
  which fetches this app's own `/api/mb/v1/...` route. That route adds the key on the server.

## Run it

You need Node.js 20.9 or newer, and your team's key.

```bash
npm install
cp .env.example .env.local      # then paste your team key into .env.local
npm run dev                     # http://localhost:3000
```

`npm run build && npm start` runs the production build. The project uses npm and ships a `package-lock.json`.
Dependency versions are pinned exactly.

## How the key stays secret

The browser never calls the API directly, and it never sees the key.

1. A page asks this app for `/api/mb/v1/suburbs/Surry%20Hills/crime/summary`.
2. The route handler in [`src/app/api/mb/[...path]/route.ts`](src/app/api/mb/[...path]/route.ts) reads
   `MICROBURBS_API_KEY` from the environment and calls
   `https://api-ht.microburbs.com.au/v1/suburbs/Surry%20Hills/crime/summary` with
   `Authorization: Bearer <key>`.
3. It returns the API's response body unchanged. It adds a few headers for the inspector, such as the
   upstream URL without the key and the upstream time.

The fetch code is in [`src/lib/server/microburbs.ts`](src/lib/server/microburbs.ts). It imports
`server-only`, so the build fails if a client component ever imports it. Never give the key a
`NEXT_PUBLIC_` prefix, because that would put it in the JavaScript bundle. The inspector always shows
`YOUR_TEAM_KEY` in place of the key.

The route only forwards `GET` requests under `/v1/`. If you deploy the app somewhere public, anyone could
use that route with your key, so put your own login in front of it first.

## Password gate

Set `DEMO_GATE=on` and `DEMO_PASSWORD=<a password>` to put the whole app behind a password: visitors see
**Enter your password** first, and the data route answers 401 until they have. `DEMO_GATE=off` (or unset)
leaves the app open, which is how it runs locally. The check is in [`src/proxy.ts`](src/proxy.ts).

## Being polite to the API

Each key gets about 10 requests a second. The server-side client:

- sends at most 8 requests a second, and waits and retries when the API answers `429`;
- caches successful answers in memory and in Next's data cache for an hour;
- marks `/api/mb` answers cacheable (`s-maxage=3600`), so on Vercel the CDN answers repeats without a call;
- shares one upstream call when two requests for the same path arrive together.

The browser also sends no more than 6 requests to the app at once. The first visit to `/city` makes 88
calls (mesh blocks, outline and one layer for each suburb) and takes 10 to 20 seconds; suburbs fill in as
their data arrives. After that, the page loads from the cache.

## Things worth knowing about the API

- **Suburb names are exact ABS names.** Some have suffixes, such as `Glebe (NSW)` and
  `The Rocks (Sydney - NSW)`. Take them from `GET /v1/suburbs/list` or `GET /v1/geocode/suburb?q=` rather
  than typing them. Encode them in the path: `/v1/suburbs/Glebe%20(NSW)/...`.
- **No data is not an error.** You get HTTP 200 with `{"data": null, "available": false, "message": ...}`.
  Every panel here handles `data === null` and shows the message.
- **Anything outside the City of Sydney returns 403**, and the geocoders answer outside addresses with
  `data: null`.
- **Block-level layers join on the mesh-block code.** `shapes/mesh-blocks` gives polygons with
  `properties.mb`; the `*-map` endpoints give values keyed by the same `mb`. House-price and rent maps cover
  houses only, so apartment-only blocks (most of the CBD) have no figure there.
- **The finder ranks; it doesn't always give values.** `finder/search` returns a `rank` for every suburb, and
  values only for the top and bottom five when sorting by a median or a growth figure.

## Project layout

```
src/
  app/
    api/mb/[...path]/route.ts   the only place the browser's requests leave the app
    page.tsx                    homepage with the universal search
    suburbs/ listings/ heatmaps/ crime/ property/ market/ compare/ finder/ map/
  components/
    Inspector.tsx               the API calls panel (collapsible, remembered)
    ChoroplethMap.tsx           GeoJSON over a MapLibre base map, coloured by value
    UniversalSearch.tsx         one box for suburbs and addresses
    LineChart.tsx               SVG time series
    PageShell.tsx               page frame, panels, loading and empty states
  lib/
    server/microburbs.ts        server-only API client: api(path), key, pacing, retries, cache
    api-store.tsx               useApi(path): fetches through /api/mb and logs each call for the inspector
    api.ts                      paths, response types, curl/JS/Python snippets
    layers.ts                   the block-level map layers
    pages.ts                    the demo list (nav and homepage), plus the "More demos" links
    theme.ts                    dark/light theme and the API panel state
```

To add a page, add an entry to `src/lib/pages.ts` and create `src/app/<slug>/page.tsx`. In the page,
render `<PageShell slug="<slug>">` and fetch with `useApi("/v1/...")`. Wrap each block in
`<Panel calls={[result.call]}>` so its calls are linked to the inspector.

Maps use [MapLibre GL](https://maplibre.org) over free [OpenFreeMap](https://openfreemap.org) base maps
(OpenStreetMap data, no key, commercial use allowed with attribution). Charts are plain SVG. Styling is
Tailwind CSS v4 with CSS-variable tokens for the dark and light themes (`src/app/globals.css`). The functions
run in Vercel's Sydney region (`vercel.json`), next to the API.

Listing photos are free Pexels stock images in `public/photos`, chosen per listing and marked "Sample photo":
the API does not return listing photos.
