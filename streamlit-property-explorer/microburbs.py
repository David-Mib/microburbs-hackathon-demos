"""A small client for the Microburbs Hackathon API.

It knows nothing about Streamlit, so you can lift it into a notebook or a
script unchanged. The app adds caching on top (see ``streamlit_app.py``).

Every call returns a ``Result`` that is one of four things:

    status == "ok"       -> result.data holds the payload
    status == "empty"    -> HTTP 200 but {"data": null, ...}: nothing to show
    status == "outside"  -> HTTP 403: the address/suburb is outside the area
    status == "error"    -> anything else (bad key, rate limit, network)

so callers branch on ``result.status`` instead of catching exceptions.
"""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import requests

DEFAULT_BASE = "https://api-ht.microburbs.com.au"
MAX_PARALLEL = 6  # the API allows ~10 req/s per key; stay well under it


@dataclass(frozen=True)
class Result:
    status: str  # "ok" | "empty" | "outside" | "error"
    data: Any = None
    message: str | None = None
    reason: str | None = None  # machine-readable, e.g. "no_data", "outside_hackathon_area"

    @property
    def ok(self) -> bool:
        return self.status == "ok"


class Microburbs:
    def __init__(self, api_key: str, base_url: str | None = None, timeout: float = 20):
        if not api_key:
            raise ValueError("An API key is required (MICROBURBS_API_KEY).")
        self.base_url = (base_url or os.environ.get("MICROBURBS_API_BASE") or DEFAULT_BASE).rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {api_key}"

    # --- Core -------------------------------------------------------------

    def get(self, path: str, **params: Any) -> Result:
        """GET a path such as '/v1/suburbs/list' and normalise the envelope."""
        try:
            resp = self.session.get(f"{self.base_url}{path}", params=params or None, timeout=self.timeout)
        except requests.RequestException as exc:
            return Result("error", message=f"Could not reach the API: {exc}")

        if resp.status_code == 403:
            return Result("outside", message=_detail(resp), reason="outside_hackathon_area")
        if not resp.ok:
            return Result("error", message=f"HTTP {resp.status_code}: {_detail(resp)}")

        body = resp.json()
        if body.get("data") is None:
            return Result("empty", message=body.get("message") or "No data available.", reason=body.get("reason"))
        return Result("ok", data=body["data"])

    def get_many(self, paths: dict[str, str]) -> dict[str, Result]:
        """Fetch several paths in parallel. ``paths`` maps a name to a path."""
        with ThreadPoolExecutor(max_workers=MAX_PARALLEL) as pool:
            futures = {name: pool.submit(self.get, path) for name, path in paths.items()}
            return {name: f.result() for name, f in futures.items()}

    # --- Convenience wrappers ---------------------------------------------

    def suburbs(self) -> Result:
        return self.get("/v1/suburbs/list")

    def geocode_address(self, address: str) -> Result:
        return self.get("/v1/geocode/address", address=address)

    def recent_sales(self, suburb: str, limit: int = 100) -> Result:
        return self.get(suburb_path(suburb, "sales/recent"), limit=limit)


def property_path(gnaf_id: str, endpoint: str) -> str:
    """'/v1/properties/{gnaf_id}/{endpoint}', e.g. endpoint='basics/all'."""
    return f"/v1/properties/{quote(gnaf_id, safe='')}/{endpoint}"


def suburb_path(suburb: str, endpoint: str) -> str:
    """'/v1/suburbs/{name}/{endpoint}'. Names are exact ABS names, e.g. 'Glebe (NSW)'."""
    return f"/v1/suburbs/{quote(suburb, safe='')}/{endpoint}"


def _detail(resp: requests.Response) -> str:
    try:
        return str(resp.json().get("detail", resp.text))
    except ValueError:
        return resp.text
