# Microburbs Hackathon API: demos

Working examples built on the [Microburbs Hackathon API](https://api-ht.microburbs.com.au/docs):
property and suburb data for every suburb and address in the **City of Sydney**. Copy them, take
them apart, build on them.

| Demo | Stack | What it shows |
| --- | --- | --- |
| [`python-quickstart`](python-quickstart/) | Python, Jupyter, pandas | The first ten minutes: find an address, pull its value and sales, then all 29 suburbs into one table and a chart. |
| [`nextjs-suburb-map`](nextjs-suburb-map/) | Next.js, TypeScript | The showcase: a block-by-block map of the whole City of Sydney, crime, market, property, compare and a suburb finder, with every API call shown beside it. |
| [`streamlit-property-explorer`](streamlit-property-explorer/) | Python, Streamlit | Type an address, get a one-page property report. The quickest way to a data app in Python. |
| [`fastapi-property-report`](fastapi-property-report/) | Python, FastAPI, HTML + htmx | The same report as a classic web app: a Python back end rendering HTML, no JavaScript build. |

## Your key

Every team has a key. Keep it out of your code and out of git: each demo reads it from the
`MICROBURBS_API_KEY` environment variable (copy `.env.example` to `.env` and paste it in).
Apps that run in a browser should call the API from a server, as these demos do, so the key never
reaches the page.

## Try the API in one line

```bash
curl 'https://api-ht.microburbs.com.au/v1/properties/GANSW705970502/profile' \
  -H 'Authorization: Bearer YOUR_TEAM_KEY'
```

```python
import os, requests

r = requests.get(
    "https://api-ht.microburbs.com.au/v1/suburbs/Surry Hills/market/all",
    headers={"Authorization": f"Bearer {os.environ['MICROBURBS_API_KEY']}"},
)
print(r.json()["data"])
```

## Good to know

- **Coverage:** the City of Sydney's 29 suburbs and every address in them. Anything outside returns
  `403`. `GET /v1/suburbs/list` gives the suburbs; `/v1/geocode/address` turns an address into the
  `gnaf_id` the property endpoints use.
- **No data is still a 200:** `{"data": null, "available": false, "reason": ..., "message": ...}`.
  Check `data` before using it.
- **Limits:** about 10 requests a second per key. On `429`, wait and retry.
- **Docs:** [api-ht.microburbs.com.au/docs](https://api-ht.microburbs.com.au/docs) lists every
  endpoint and lets you try each one with your key.

## Licence

[MIT](LICENSE). Data © Microburbs; estimates are automated and indicative only.
