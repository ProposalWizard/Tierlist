import DevGate from "@/components/admin/DevGate";

/** The one lock (components/admin/DevGate.tsx): the Marketing tab is admins only (lib/adminRegistry.ts). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/admin/marketing">{children}</DevGate>;
}
