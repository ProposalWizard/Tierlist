import DevGate from "@/components/admin/DevGate";

/** Admins only (Harry, 5 Oct 2026: "lock the doors"). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/draft-challenge-dev">{children}</DevGate>;
}
