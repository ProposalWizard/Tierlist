import type { Metadata } from "next";
import SaveFailedBanner from "@/components/star/SaveFailedBanner";
import OtherDeviceBanner from "@/components/star/OtherDeviceBanner";
import GameFullScreen from "@/components/star/GameFullScreen";

export const metadata: Metadata = {
  title: "Star Career — Admin Only",
  robots: { index: false, follow: false },
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
    </>
  );
}
