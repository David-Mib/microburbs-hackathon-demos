import type { Metadata } from "next";
import { CityMap } from "./CityMap";

export const metadata: Metadata = { title: "City map" };

export default function Page() {
  return <CityMap />;
}
