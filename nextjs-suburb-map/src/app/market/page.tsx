import type { Metadata } from "next";
import { MarketDashboard } from "./MarketDashboard";

export const metadata: Metadata = { title: "Market dashboard" };

export default function Page() {
  return <MarketDashboard />;
}
