import type { Metadata } from "next";
import ChallengeDraftClient from "./ChallengeDraftClient";
import PageGuide from "@/components/admin/PageGuide";

export const metadata: Metadata = {
  title: "Challenge Draft (dev)",
  robots: { index: false, follow: false },
};

export default function ChallengeDraftDevPage() {
  return (
    <>
      <ChallengeDraftClient />
      <PageGuide page="/draft-challenge-dev" />
    </>
  );
}
