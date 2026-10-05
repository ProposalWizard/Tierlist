import type { Metadata } from "next";
import TesterOnly from "@/components/TesterOnly";

export const metadata: Metadata = { title: "Blender 3D" };

export default function BlenderLayout({ children }: { children: React.ReactNode }) {
  return <TesterOnly>{children}</TesterOnly>;
}
