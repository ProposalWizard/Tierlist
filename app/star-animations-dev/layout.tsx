import DevGate from "@/components/admin/DevGate";

/** Admins and testers. Only shows animations and edits this browser's own animation dials; saves nothing anyone else sees. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-animations-dev">{children}</DevGate>;
}
