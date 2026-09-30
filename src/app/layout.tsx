import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { SiteHeader } from "@/components/site-header";
import { snapshot } from "@/lib/data";
import { utc } from "@/lib/format";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Backed — what exchange reserves are made of",
  description:
    "Every exchange reserve CoinMarketCap publishes, checked against CoinMarketCap's own supply, market and derivatives data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = `${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`;
  return (
    <html lang="en" suppressHydrationWarning className={`${fonts} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <SiteHeader snapshotLabel={`Snapshot ${utc(snapshot.generatedAt)}`} />
          <main className="flex-1">{children}</main>
          <footer className="border-t">
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted-foreground sm:grid-cols-3 sm:px-6">
              <div>
                <p className="font-medium text-foreground">Backed</p>
                <p className="mt-1">Built for Build with CMC: API Hackathon. Data and Visualisation track.</p>
              </div>
              <div className="space-y-1">
                <Link href="/method" className="block hover:text-foreground">
                  Method
                </Link>
                <Link href="/api-notes" className="block hover:text-foreground">
                  API notes
                </Link>
                <Link href="/#exchanges" className="block hover:text-foreground">
                  All exchanges
                </Link>
              </div>
              <div>
                <p>Data from the CoinMarketCap Pro API.</p>
                <p className="mt-1">Not a solvency test. Reserves data carries no liabilities.</p>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
