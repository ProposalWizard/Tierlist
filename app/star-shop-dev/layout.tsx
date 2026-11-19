import DevGate from "@/components/admin/DevGate";

/** Admins and testers. Only plays the shop on a made-up career; saves nothing. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DevGate url="/star-shop-dev">{children}</DevGate>;
}
