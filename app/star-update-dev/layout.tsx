import DevGate from "@/components/admin/DevGate";

/** Admins and testers. Flips this phone's Oct 13 update switch; saves nothing anyone else sees. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-update-dev">{children}</DevGate>;
}
