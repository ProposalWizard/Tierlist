import type { Metadata } from "next";
import TesterOnly from "@/components/TesterOnly";

export const metadata: Metadata = { title: "3D Home" };

/** Admins and testers. Only plays the game; saves nothing anyone else sees. */
export default function Home3DLayout({ children }: { children: React.ReactNode }) {
  return <TesterOnly>{children}</TesterOnly>;
}
