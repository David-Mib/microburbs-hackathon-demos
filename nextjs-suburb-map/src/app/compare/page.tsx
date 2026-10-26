import type { Metadata } from "next";
import { SuburbCompare } from "./SuburbCompare";

export const metadata: Metadata = { title: "Suburb comparison" };

export default function Page() {
  return <SuburbCompare />;
}
