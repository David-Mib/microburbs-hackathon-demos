import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import Script from "next/script";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ApiProvider } from "@/lib/api-store";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const sans = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Microburbs API demos: the City of Sydney, block by block",
    template: "%s | Microburbs API demos",
  },
  description:
    "Suburb reports, a listings portal, heat maps, crime and property profiles for the City of Sydney, built on the Microburbs Hackathon API. Every page shows the API calls behind it.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070b13" },
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Dark by default; THEME_SCRIPT drops the class before paint if light was chosen.
    <html lang="en-AU" className={`dark ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <SiteHeader />
        <ApiProvider>
          <div className="flex-1">{children}</div>
        </ApiProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
