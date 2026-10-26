import type { Metadata } from "next";
import { PropertyProfile } from "./PropertyProfile";

export const metadata: Metadata = { title: "Property profile" };

export default function Page() {
  return <PropertyProfile />;
}
