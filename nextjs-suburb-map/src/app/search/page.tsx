import type { Metadata } from "next";
import { SuburbSearch } from "./SuburbSearch";

export const metadata: Metadata = { title: "Suburb search" };

export default function Page() {
  return <SuburbSearch />;
}
