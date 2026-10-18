import DevGate from "@/components/admin/DevGate";

/** Admins and testers. Plays sounds; saves only to this browser. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-sound-lab-dev">{children}</DevGate>;
}
