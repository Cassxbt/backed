import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { snapshot } from "@/lib/data";
import { utc } from "@/lib/format";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Backed — what exchange reserves are made of",
  description:
    "Four checks on every exchange that reports proof-of-reserves to CoinMarketCap, built only on CoinMarketCap data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={100}>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <footer className="border-t">
              <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
                <p>Data from the CoinMarketCap Pro API. Snapshot {utc(snapshot.generatedAt)}.</p>
                <p>Not a solvency test. Reserves data carries no liabilities.</p>
              </div>
            </footer>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
