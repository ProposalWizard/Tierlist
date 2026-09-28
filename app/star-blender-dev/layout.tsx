import type { Metadata } from "next";

export const metadata: Metadata = { title: "Blender 3D" };

export default function BlenderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
