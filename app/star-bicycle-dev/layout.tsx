import TesterOnly from "@/components/TesterOnly";

/** Admins and testers (Harry, 5 Oct 2026: tester access). Only plays the game; saves nothing anyone else sees. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TesterOnly>{children}</TesterOnly>;
}
