import DevGate from "@/components/admin/DevGate";

/** The one lock (components/admin/DevGate.tsx): who may open this page comes from lib/adminRegistry.ts. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-awards-night-dev">{children}</DevGate>;
}
