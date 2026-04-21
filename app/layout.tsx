/**
 * app/layout.tsx
 * Root layout – wraps every page.
 * Sets global font, meta tags, and imports Tailwind CSS.
 */

import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import GlobalNav from "@/components/GlobalNav";
import SiteFooter from "@/components/SiteFooter";

const GA_ID = "G-ZEGDB8YDZZ";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
    <html lang="en">
      <head>
        <link rel="dns-prefetch" href="https://cagkgfketucousksgtbk.supabase.co" />
        <link rel="preconnect" href="https://cagkgfketucousksgtbk.supabase.co" crossOrigin="anonymous" />
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
      </head>
      <body className={`font-sans bg-gray-950 text-gray-100 min-h-screen flex flex-col overflow-x-hidden`}>
        <GlobalNav />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
