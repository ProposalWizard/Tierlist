import type { Metadata } from "next";
import PublicHome from "@/components/home/PublicHome";
import { HOME_METADATA } from "@/components/home/meta";

/**
 * The public home (Harry, 12 Nov 2026): look D, "Cream phone", tiles three a
 * row on a phone. The page itself is components/home/PublicHome.tsx; other
 * looks stay on the test page /home-new-dev.
 */
export const metadata: Metadata = HOME_METADATA;

export default function HomePage() {
  return <PublicHome look="d" v="2" />;
}
