import DevGate from "@/components/admin/DevGate";

/** Admins and testers. Plays the real match on a test club; saves nothing. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-pc-match-dev">{children}</DevGate>;
}
