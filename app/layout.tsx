/**
 * app/layout.tsx
 * Root layout – wraps every page.
 * Sets global font, meta tags, and imports Tailwind CSS.
 */

import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import GlobalNav from "@/components/GlobalNav";
import SiteFooter from "@/components/SiteFooter";
import { PostHogProvider } from "@/components/PostHogProvider";

const GA_ID = "G-ZEGDB8YDZZ";

/**
 * CINZEL, SELF-HOSTED.
 *
 * It used to come from `next/font/google`, which downloads the font FROM
 * GOOGLE DURING THE BUILD. That makes every production deploy depend on
 * fonts.googleapis.com being reachable and answering in a shape Next can
 * parse — and on 21 Sep it wasn't, so the build died with
 *
 *     app/layout.tsx — An error occurred in `next/font`
 *     TypeError: Cannot read properties of null (reading '1')
 *
 * which is Next's Google-font loader failing to parse an empty response. No
 * code had changed; the deploy just happened to land while the fetch failed.
 *
 * The file now lives in the repo, so a build needs no network and cannot
 * fail this way again. It is the same font, the same variable file Google
 * itself serves for the `latin` subset — which is exactly what
 * `subsets: ["latin"]` asked for before, so nothing on screen changes.
 * Cinzel is SIL Open Font License, which permits exactly this.
 *
 * One variable file covers 600/700/900 — Google serves all three weights
 * from this one file, so the three separate weights are a range here.
 */
const cinzel = localFont({
  src: "./fonts/cinzel-latin-var.woff2",
  weight: "400 900",
  style: "normal",
  variable: "--font-cinzel",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays enabled. Blocking it fails WCAG 1.4.4, and this UI is full
  // of deliberately tiny type — 6-10px in the tic-tac-toe archive grid, the
  // scoreboards and the star dashboard — so a reader who cannot make it out has
  // no other way to, since there is no in-app text-size control.
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://knowitball.co.uk"),
  title: {
    default: "Knowitball",
    template: "%s | Knowitball",
  },
  description: "Drag and drop football players into S, A, B, C, D tiers. Save and share your rankings — free forever.",
  openGraph: {
    type: "website",
    siteName: "Knowitball Tierlists",
    title: "Knowitball Tierlists",
    description: "Drag and drop football players into S, A, B, C, D tiers. Save and share your rankings.",
  },
  twitter: {
    card: "summary",
    title: "Knowitball Tierlists",
    description: "Drag and drop football players into S, A, B, C, D tiers. Save and share your rankings.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cinzel.variable}>
      <head>
        <link rel="dns-prefetch" href="https://cagkgfketucousksgtbk.supabase.co" />
        <link rel="preconnect" href="https://cagkgfketucousksgtbk.supabase.co" crossOrigin="anonymous" />
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
      </head>
      <body className={`font-sans bg-gray-950 text-gray-100 min-h-screen flex flex-col overflow-x-hidden`}>
        <PostHogProvider>
          <GlobalNav />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </PostHogProvider>
      </body>
    </html>
  );
}
