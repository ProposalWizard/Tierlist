import type { Metadata } from "next";
import SaveFailedBanner from "@/components/star/SaveFailedBanner";
import OtherDeviceBanner from "@/components/star/OtherDeviceBanner";
import GameFullScreen from "@/components/star/GameFullScreen";
import ConfirmHost from "@/components/star/ConfirmHost";

export const metadata: Metadata = {
  title: "Star Career — Admin Only",
  robots: { index: false, follow: false },
  // Add to Home Screen opens the game with no browser bars (v0.25, point 3).
  // iPhone has no Fullscreen API for pages; this is the only way there.
  manifest: "/star-app.webmanifest",
  appleWebApp: { capable: true, title: "Knowitball", statusBarStyle: "black" },
  icons: { apple: "/star/app-icon-180.png" },
  other: { "mobile-web-app-capable": "yes" },
};

export default function StarDevLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* The game fills the phone: hides the site menu and footer here only. */}
      <GameFullScreen />
      {children}
      {/* "Couldn't save on this device" — see components/star/SaveFailedBanner.tsx. */}
      <SaveFailedBanner />
      {/* "Open on your phone right now" — see components/star/OtherDeviceBanner.tsx. */}
      <OtherDeviceBanner />
      {/* The game's own "Are you sure?" — never the browser's (lib/star/askConfirm.ts). */}
      <ConfirmHost />
    </>
  );
}
