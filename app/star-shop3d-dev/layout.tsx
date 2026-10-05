import type { Metadata } from "next";
import TesterOnly from "@/components/TesterOnly";

export const metadata: Metadata = { title: "3D Shop" };

export default function Shop3DLayout({ children }: { children: React.ReactNode }) {
  return <TesterOnly>{children}</TesterOnly>;
}
