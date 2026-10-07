import TesterOnly from "@/components/TesterOnly";

/** Admins and testers. Buying here spends that account's own gems only; only an admin can give gems. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TesterOnly>{children}</TesterOnly>;
}
