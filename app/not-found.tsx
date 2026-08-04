import Link from "next/link";
import { Home } from "lucide-react";
import { RoutePlaceholder } from "@/components/shared/route-placeholder";
import { AppearanceStyleTag } from "@/components/shared/appearance-style-tag";
import { getStorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";

/**
 * The root 404 answers an unmatched URL, so it renders outside every layout —
 * including the storefront shell that carries the shop's palette. A mistyped or
 * stale link (`/store/valentines-2025`) therefore landed a customer on a page
 * painted in the demo colours, with a "Back to Store" button in somebody else's
 * brown. Reading the chrome costs one query on a page nobody wants to be on,
 * and makes it look like the same shop.
 */
export default async function NotFound() {
  const chrome = await getStorefrontChrome();

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ colorScheme: "light", ...chrome.appearance } as React.CSSProperties}
    >
      <AppearanceStyleTag tokens={chrome.appearance} />
      <RoutePlaceholder
        title="404 — Page Not Found"
        description="The page you're looking for doesn't exist or has been moved."
        phase={4}
        group="storefront"
        path="/404"
      />
      <div className="-mt-8 flex justify-center pb-16">
        <Button variant="bakery" render={<Link href={routes.store.home} />}>
          <Home className="size-4" />
          Back to Store
        </Button>
      </div>
    </div>
  );
}
