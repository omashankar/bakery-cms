import { StorefrontLayoutShell } from "@/layouts/storefront-layout";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StorefrontLayoutShell>{children}</StorefrontLayoutShell>;
}
