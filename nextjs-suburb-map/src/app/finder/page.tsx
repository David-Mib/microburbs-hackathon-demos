import type { Metadata } from "next";
import { SuburbFinder } from "./SuburbFinder";

export const metadata: Metadata = { title: "Suburb finder" };

export default function Page() {
  return <SuburbFinder />;
}
