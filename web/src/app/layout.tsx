import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { SubNav } from "@/components/SubNav";
import { ChatDock } from "@/components/ChatDock";
import { KeyboardAware } from "@/components/KeyboardAware";
import { THEME_BOOT } from "@/lib/theme";
import { getDockProfile } from "@/lib/data";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://steadywag.vercel.app"),
  openGraph: { siteName: "Steadywag", type: "website" },
  title: "Steadywag",
  description:
    "Track a dog with a chronic illness, see what the records say and what they don't, and walk into every vet visit prepared. Built on Sanity.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const dock = await getDockProfile().catch(() => ({ alert: null, alertSince: null, lastVisitDate: null }));
  return (
    // suppressHydrationWarning: browser extensions often add attributes to <html> before React loads.
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-8 pt-5 sm:px-6">
          <SubNav />
          {children}
        </main>
        <footer className="no-print border-t border-line px-4 pb-28 pt-6 text-center text-sm text-muted md:pb-6">
          Steadywag tracks and prepares. It never diagnoses, doses, or replaces his vet. Records are de-identified.
        </footer>
        <KeyboardAware />
        <ChatDock profile={{ name: "Theo", line: "", status: "", alert: dock.alert ?? undefined, alertSince: dock.alertSince, lastVisitDate: dock.lastVisitDate }} />
      </body>
    </html>
  );
}
