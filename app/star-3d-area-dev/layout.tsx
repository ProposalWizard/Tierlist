import type { Metadata } from "next";
import TesterOnly from "@/components/TesterOnly";

export const metadata: Metadata = { title: "3D Test Area" };

export default function Area3dLayout({ children }: { children: React.ReactNode }) {
  return <TesterOnly>{children}</TesterOnly>;
}
