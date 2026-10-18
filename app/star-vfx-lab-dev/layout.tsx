import DevGate from "@/components/admin/DevGate";

/** Admins and testers. Draws effect pictures and plays the real match; saves only to this browser. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-vfx-lab-dev">{children}</DevGate>;
}
