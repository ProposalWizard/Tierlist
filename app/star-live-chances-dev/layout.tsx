import DevGate from "@/components/admin/DevGate";

/** Admins and testers. Its switch and dials live on this page only; nothing is saved. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-live-chances-dev">{children}</DevGate>;
}
