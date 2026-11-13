/**
 * app/layout.app.tsx — the PACKED PHONE APP's only layout.
 *
 * Read only by the app build (next.config.mjs, KIB_APP_BUILD=1, which looks
 * for `*.app.tsx` files and nothing else). The website build ignores this
 * file: its pages are `page.tsx` / `layout.tsx`. See mobile/README.md.
 *
 * No site menu, no footer, no cookie banner, no analytics: the app is only
 * Road to Ballon d'Or. Zoom is off. The page is NOT stretched under the notch
 * and home bar (no viewport-fit=cover): the phone keeps the game inside the
 * safe area, so no button can sit under either.
 */
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

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
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b100e",
};

export const metadata: Metadata = {
  title: "KnowItBall: Road to the Golden Ball",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cinzel.variable}>
      <body className="font-sans bg-gray-950 text-gray-100 min-h-screen overflow-x-hidden" data-kib-app>
        {children}
      </body>
    </html>
  );
}
