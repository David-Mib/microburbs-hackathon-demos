"use client";

import { type SuburbListItem, type FeatureCollection, type Feature, suburbPath } from "./api";
import { useApi } from "./api-store";

/**
 * The hackathon area: the 29 suburbs of the City of Sydney. We never hard-code
 * the list; GET /v1/suburbs/list returns it, with the exact names the
 * /v1/suburbs/{name}/... routes expect ("Glebe (NSW)", not "Glebe").
 */
export function useSuburbList() {
  const r = useApi<SuburbListItem[]>("/v1/suburbs/list");
  return { ...r, names: r.data?.map((s) => s.suburb) ?? [] };
}

/**
 * Example addresses, one per suburb, so each demo opens on something real.
 * Any address in the area works: search for it with GET /v1/geocode/address.
 */
export const EXAMPLE_PROPERTIES = [
  { gnaf: "GANSW705970502", address: "26 Tudor Street", suburb: "Surry Hills" },
  { gnaf: "GANSW704792207", address: "26 Ferry Road", suburb: "Glebe" },
  { gnaf: "GANSW705766342", address: "72 Baptist Street", suburb: "Redfern" },
  { gnaf: "GANSW704724227", address: "1 Bray Street", suburb: "Erskineville" },
  { gnaf: "GANSW705702281", address: "166 Harris Street", suburb: "Pyrmont" },
  { gnaf: "GANSW706400874", address: "59 Hansard Street", suburb: "Zetland" },
  { gnaf: "GANSW706194440", address: "81 Kellick Street", suburb: "Waterloo" },
  { gnaf: "GANSW704549881", address: "185 Palmer Street", suburb: "Darlinghurst" },
];

type MeshBlocks = { count: number; geojson: FeatureCollection };
type Boundary = { geojson: Feature };

/** A suburb's mesh-block polygons and its outline, for any per-block map. */
export function useSuburbShapes(suburb: string | null) {
  const blocks = useApi<MeshBlocks>(suburb ? suburbPath(suburb, "shapes/mesh-blocks") : null);
  const boundary = useApi<Boundary>(suburb ? suburbPath(suburb, "shapes/boundary") : null);
  return {
    shapes: blocks.data?.geojson ?? null,
    boundary: boundary.data?.geojson ?? null,
    calls: [blocks.call, boundary.call],
    loading: blocks.loading,
    error: blocks.error,
  };
}
