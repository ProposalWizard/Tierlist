import type { Metadata } from "next";
import AdminOnly from "@/components/AdminOnly";

export const metadata: Metadata = { title: "Blender 3D" };

export default function BlenderLayout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>;
}
