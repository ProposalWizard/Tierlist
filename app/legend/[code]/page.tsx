import type { Metadata } from "next";
import LegendView from "./LegendView";

/**
 * A SHARED CAREER — knowitball.co.uk/legend/K7Q2XM (Leo, 6 Oct 2026: "Online:
 * share a career, compare with a friend"). Read only, no sign-in: the career
 * overview, the share picture, and "Compare with yours".
 */
export const metadata: Metadata = {
  title: "A Knowitball legend",
  description: "One player's whole football career, season by season. Compare it with yours.",
};

export default function LegendPage({ params }: { params: { code: string } }) {
  return <LegendView code={params.code} />;
}
