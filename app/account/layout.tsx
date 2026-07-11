import { StorefrontLayoutShell } from "@/layouts/storefront-layout";

export default function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <StorefrontLayoutShell>{children}</StorefrontLayoutShell>;
}
