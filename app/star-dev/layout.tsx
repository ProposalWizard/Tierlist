import type { Metadata } from "next";
import SaveFailedBanner from "@/components/star/SaveFailedBanner";

export const metadata: Metadata = {
  title: "Star Career — Admin Only",
  robots: { index: false, follow: false },
};

export default function StarDevLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* "Couldn't save on this device" — see components/star/SaveFailedBanner.tsx. */}
      <SaveFailedBanner />
    </>
  );
}
