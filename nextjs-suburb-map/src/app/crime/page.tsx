import type { Metadata } from "next";
import { CrimeDashboard } from "./CrimeDashboard";

export const metadata: Metadata = { title: "Crime and safety" };

export default function Page() {
  return <CrimeDashboard />;
}
