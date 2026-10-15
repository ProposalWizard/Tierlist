import TesterOnly from "@/components/TesterOnly";

/** Admins and testers. Plays sounds; saves only to this browser. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TesterOnly>{children}</TesterOnly>;
}
