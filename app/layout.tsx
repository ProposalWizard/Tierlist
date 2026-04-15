/**
 * app/layout.tsx
 * Root layout – wraps every page.
 * Sets global font, meta tags, and imports Tailwind CSS.
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";
import GlobalNav from "@/components/GlobalNav";
import SiteFooter from "@/components/SiteFooter";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: "Knowitball Tierlists",
    template: "%s | Knowitball Tierlists",
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
      <body className={`font-sans bg-gray-950 text-gray-100 min-h-screen flex flex-col overflow-x-hidden`}>
        <GlobalNav />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
