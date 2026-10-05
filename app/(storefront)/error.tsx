"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { useBusinessLabels } from "@/hooks/use-business-labels";

/**
 * The storefront's last line of defence.
 *
 * These pages render admin-authored content on the server — homepage and wedding
 * sections the page builder writes — and there was no boundary anywhere beneath
 * `app/(storefront)`. One malformed section and every visitor got Next's raw 500
 * page: a stack-trace shell with no navigation, no way back to the shop, and no
 * indication the bakery is still open. The section payload is shape-checked at
 * the write now, but a page that sells cakes should not have a single unhandled
 * render standing between a customer and a blank error screen.
 */
export default function StorefrontError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const labels = useBusinessLabels();
  const router = useRouter();

  /**
   * `reset` alone cannot recover from the failure this page exists for.
   *
   * It clears the boundary's error state and re-renders the SAME children —
   * and for a server-render failure those children are a result that already
   * threw, so it throws again on the same tick and the visitor sees the identical
   * screen with no sign anything happened. `router.refresh()` refetches the RSC
   * payload first, so the retry is a real one.
   */
  function retry() {
    router.refresh();
    reset();
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="space-y-3">
        <h1 className="font-heading text-2xl font-bold text-bakery-950 sm:text-3xl">
          Something went wrong on this page
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Sorry about that — the rest of the shop is fine. Try again, or head back
          to browse our {labels.productWordPlural.toLowerCase()}.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="bakery" onClick={retry}>
          Try again
        </Button>
        <Button variant="outline" render={<Link href={routes.store.home} />}>
          Back to the shop
        </Button>
      </div>
    </div>
  );
}
