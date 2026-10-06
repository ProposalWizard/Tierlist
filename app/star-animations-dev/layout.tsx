import TesterOnly from "@/components/TesterOnly";

/** Admins and testers. Only shows animations and edits this browser's own animation dials; saves nothing anyone else sees. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TesterOnly>{children}</TesterOnly>;
}
