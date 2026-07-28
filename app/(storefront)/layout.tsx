import { StorefrontLayoutShell } from "@/layouts/storefront-layout";
import { getStorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read navbar + footer data from MongoDB on the server so the store name, nav,
  // contact and footer render real in the HTML (no defaults-then-hydrate flash).
  const chrome = await getStorefrontChrome();
  return <StorefrontLayoutShell chrome={chrome}>{children}</StorefrontLayoutShell>;
}
