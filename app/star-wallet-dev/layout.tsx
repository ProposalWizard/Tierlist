import DevGate from "@/components/admin/DevGate";

/** Admins and testers. Buying here spends that account's own gems only; only an admin can give gems. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-wallet-dev">{children}</DevGate>;
}
