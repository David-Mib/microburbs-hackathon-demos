import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { ApiProvider } from "@/lib/api-store";
import "./globals.css";

const sans = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "City of Sydney on the Microburbs API",
    template: "%s | City of Sydney on the Microburbs API",
  },
  description:
    "Live demos built on the Microburbs Hackathon API: block-level maps, market history, crime, property profiles and suburb rankings for the City of Sydney. Every page shows the API calls behind it.",
};

export const viewport: Viewport = { themeColor: "#f5f7fa" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <SiteHeader />
        <ApiProvider>{children}</ApiProvider>
      </body>
    </html>
  );
}
