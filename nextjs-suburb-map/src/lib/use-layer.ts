"use client";

import { suburbPath } from "./api";
import { type ApiResult, useApi } from "./api-store";
import type { Layer, LayerBody } from "./layers";

/** Fewer house blocks than this and the map asks for units instead. */
const THIN = 5;

const count = (r: ApiResult<LayerBody>) => r.data?.microburbs?.length ?? 0;

/**
 * One layer for one suburb. Price and rent come per house by default; most
 * inner-city blocks are units, so when the house map is empty or thin we ask
 * the same endpoint for units and show whichever covers more blocks.
 */
export function useLayer(suburb: string, layer: Layer) {
  const house = useApi<LayerBody>(suburbPath(suburb, layer.tail));
  const thin = !!layer.unit && !house.loading && !house.error && count(house) < THIN;
  const unit = useApi<LayerBody>(thin && layer.unit ? suburbPath(suburb, layer.unit.tail) : null);
  const useUnit = thin && count(unit) > count(house);
  const result = useUnit ? unit : house;
  return {
    ...result,
    loading: house.loading || (thin && unit.loading),
    legend: useUnit && layer.unit ? layer.unit.legend : layer.legend,
    calls: [house.call, ...(thin ? [unit.call] : [])],
  };
}
