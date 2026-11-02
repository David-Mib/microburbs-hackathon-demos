import type { Metadata } from "next";
import { HeatMaps } from "./HeatMaps";

export const metadata: Metadata = { title: "Heat maps" };

export default function Page() {
  return <HeatMaps />;
}
