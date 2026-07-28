import { StorefrontLayoutShell } from "@/layouts/storefront-layout";
import { getStorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";

export default async function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const chrome = await getStorefrontChrome();
  return <StorefrontLayoutShell chrome={chrome}>{children}</StorefrontLayoutShell>;
}
