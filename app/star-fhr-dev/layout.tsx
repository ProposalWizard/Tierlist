import DevGate from "@/components/admin/DevGate";

/** Admins and testers. Measures and flips a switch on this phone; saves nothing anyone else sees. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-fhr-dev">{children}</DevGate>;
}
