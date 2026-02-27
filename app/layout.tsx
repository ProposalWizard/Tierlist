/**
 * app/layout.tsx
 * Root layout – wraps every page.
 * Sets global font, meta tags, and imports Tailwind CSS.
 */

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Football Tierlist",
  description: "Drag & drop your football player tier rankings",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`font-sans bg-gray-950 text-gray-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
