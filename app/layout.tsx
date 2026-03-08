/**
 * app/layout.tsx
 * Root layout – wraps every page.
 * Sets global font, meta tags, and imports Tailwind CSS.
 */

import type { Metadata } from "next";
import "./globals.css";
import GlobalNav from "@/components/GlobalNav";

export const metadata: Metadata = {
  title: {
    default: "Football Tierlist",
    template: "%s | Football Tierlist",
  },
  description: "Drag and drop football players into S, A, B, C, D tiers. Save and share your rankings — free forever.",
  openGraph: {
    type: "website",
    siteName: "Football Tierlist",
    title: "Football Tierlist",
    description: "Drag and drop football players into S, A, B, C, D tiers. Save and share your rankings.",
  },
  twitter: {
    card: "summary",
    title: "Football Tierlist",
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
      <body className={`font-sans bg-gray-950 text-gray-100 min-h-screen`}>
        <GlobalNav />
        {children}
      </body>
    </html>
  );
}
