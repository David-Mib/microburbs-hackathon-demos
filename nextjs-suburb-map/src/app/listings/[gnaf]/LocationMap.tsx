"use client";

import { useRouter } from "next/navigation";
import { ChoroplethMap, type Marker, RAMPS } from "@/components/ChoroplethMap";

const NO_VALUES = new Map<string, number>();
const fmtNone = () => "";

/** The listing (orange) and recent sales nearby (dots) on the base map. */
export function LocationMap({ markers, links }: { markers: Marker[]; links: Record<string, string> }) {
  const router = useRouter();
  return (
    <ChoroplethMap
      shapes={[]}
      values={NO_VALUES}
      markers={markers}
      format={fmtNone}
      ramp={RAMPS.blue}
      legend=""
      caption="The listing and recent sales nearby"
      hint="Orange is this home; dots are recent sales nearby. Point at one for its price."
      onMarkerClick={(id) => links[id] && router.push(links[id])}
      maxHeight={420}
      hideLegend
    />
  );
}
