# Property Report (FastAPI + htmx)

A one-page property report for any address in the City of Sydney, built on the
[Microburbs Hackathon API](https://api-ht.microburbs.com.au/docs).

Type an address (or pick a suburb and choose one of its recent sales) and you get:

- **What the property is**: dwelling type, beds, baths, parking, suburb
- **Estimated value** with its 80% range and a confidence score, and how it compares with the last sale
- **Value over time**: the modelled value history with past sales marked (houses), or the suburb's median price trend (apartments, which have no per-property series)
- **Sale history**, with the change between sales
- **Risks**: flood, heritage, bushfire, power lines and more, each marked as on the property, nearby or clear
- **Nearby schools** with NAPLAN ranking, and **getting around**: nearest train, bus and ferry, plus shops, parks and restaurants within 1 km
- **A map** of the neighbourhood: the property, nearest stops, recent sales and amenities
- **About the suburb**: median house and unit price, median rent, 5-year growth, yield, days on market, population, household income, share of renters
- The **raw JSON** of every call, in a collapsed section at the bottom

![Screenshot of the report for 26 Tudor Street, Surry Hills](docs/screenshot.png)

Pages are rendered on the server with Jinja2. [htmx](https://htmx.org) adds the live address search and loads the
suburb panel after the report is on screen. The map is [Leaflet](https://leafletjs.com) with OpenStreetMap tiles.
There is no JavaScript build step, and your API key never reaches the browser.

## Run it locally

You need Python 3.10 or newer and your team's API key.

```bash
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env        # then put your key in .env as MICROBURBS_API_KEY=...
uvicorn main:app --reload   # open http://127.0.0.1:8000
```

`.env` is git-ignored. Never commit your key.

## Deploy to Vercel

Vercel runs FastAPI with zero configuration: it finds the `app` object in `main.py` and installs
`requirements.txt`.

1. Import the repository in Vercel and set the project's **Root Directory** to `fastapi-property-report`.
2. Add an environment variable `MICROBURBS_API_KEY` with your key (and optionally `MICROBURBS_API_BASE`).
3. Deploy.

## How it's put together

| File | What it does |
|---|---|
| `microburbs.py` | A small API client: auth header, the `{"data": ...}` envelope, 403 → `OutsideAreaError`, and an in-memory cache (one hour) so repeat views don't repeat calls. No web-framework dependency, so you can reuse it in scripts. |
| `main.py` | The FastAPI app: routes, parallel fetching (at most 6 calls in flight, the limit is ~10/s), and the small helpers that shape data for the templates, including a dependency-free SVG line chart. |
| `templates/` | Jinja2 templates. `report.html` is the report; files starting with `_` are htmx partials. |

Routes:

| Route | Returns |
|---|---|
| `GET /` | Home page with the search sidebar |
| `GET /search?address=...` | htmx partial: up to 10 matching addresses |
| `GET /suburb-sales?suburb=...` | htmx partial: recent sales in a suburb, each linking to its report |
| `GET /property/{gnaf_id}` | The full report (a plain, shareable URL) |
| `GET /property/{gnaf_id}/suburb?suburb=...&kind=house\|unit` | htmx partial: the suburb panel |
| `GET /suburb-trend?suburb=...&kind=...` | htmx partial: suburb median price chart |

### Handling "no data" and "outside the area"

- A `200` with `{"data": null, "message": ...}` means there is nothing to show (for example, no automated valuation
  for that apartment). Every section checks for this and shows a short note instead.
- A `403` means the property or suburb is outside the hackathon area (the 29 suburbs of the City of Sydney). The report
  page shows a friendly message, and the search box says there are no matches in the area.

## Endpoints used

Property (by GNAF id, from `/v1/geocode/address`):

- `GET /v1/properties/{gnaf_id}/basics/all`
- `GET /v1/properties/{gnaf_id}/profile`
- `GET /v1/properties/{gnaf_id}/valuation/all`
- `GET /v1/properties/{gnaf_id}/valuation/value-series`
- `GET /v1/properties/{gnaf_id}/history/all`
- `GET /v1/properties/{gnaf_id}/risks/all`
- `GET /v1/properties/{gnaf_id}/schools/all`
- `GET /v1/properties/{gnaf_id}/transport/nearby`
- `GET /v1/properties/{gnaf_id}/amenities/nearby`
- `GET /v1/properties/{gnaf_id}/comparables/recent-sales-nearby`

Suburb (by exact ABS name, e.g. `Glebe (NSW)`):

- `GET /v1/suburbs/list`
- `GET /v1/suburbs/{name}/sales/recent`
- `GET /v1/suburbs/{name}/market/all`
- `GET /v1/suburbs/{name}/market/median-sale-price-series`
- `GET /v1/suburbs/{name}/hero/summary`
- `GET /v1/suburbs/{name}/demographics/income`
- `GET /v1/suburbs/{name}/demographics/tenure`

Lookup: `GET /v1/geocode/address`.

## Ideas for extending it

- Add comparables (`/comparables/cma-comp-set`) as a table next to the estimate.
- Draw flood or heritage polygons on the map with `/risks/all?geojson=true`.
- Compare the property's street with its suburb using `/street/profile`.

## Notes

- Map tiles come from OpenStreetMap's public tile server, which is fine for a demo. If your app gets real traffic,
  switch the `L.tileLayer(...)` URL in `templates/report.html` to a tile provider, as
  [OSM's tile usage policy](https://operations.osmfoundation.org/policies/tiles/) asks.
- Estimates are automated and indicative only.
