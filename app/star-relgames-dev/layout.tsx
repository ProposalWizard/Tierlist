import DevGate from "@/components/admin/DevGate";

/** Admins and testers (Harry, 5 Oct 2026: tester access). Only plays the game; saves nothing anyone else sees. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-relgames-dev">{children}</DevGate>;
}
