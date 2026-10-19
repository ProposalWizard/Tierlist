import type { Metadata } from "next";
import DevGate from "@/components/admin/DevGate";

export const metadata: Metadata = { title: "3D Scene Editor" };

export default function SceneEditorLayout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-scene-editor-dev">{children}</DevGate>;
}
