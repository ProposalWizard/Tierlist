import DevGate from "@/components/admin/DevGate";

/** Admins and testers. Plays the five-a-side; saves nothing anyone else sees. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-fiveaside-dev">{children}</DevGate>;
}
