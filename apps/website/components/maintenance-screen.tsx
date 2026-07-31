import { Clock, Wrench } from "lucide-react";

import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

/**
 * What a visitor sees while the shop is closed.
 *
 * This REPLACES the storefront rather than sitting above it. The old behaviour
 * rendered a yellow strip over a fully working shop, so "maintenance mode" let
 * customers keep browsing, adding to the cart and checking out.
 *
 * No navigation on purpose: every link would lead back into the closed shop.
 */
export function MaintenanceScreen({
  siteName,
  message,
}: {
  siteName: string;
  message: string;
}) {
  return (
    <main
      className={cn(
        "flex min-h-screen flex-col items-center justify-center bg-white text-center",
        layoutSpacing.container
      )}
      style={{ colorScheme: "light" }}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-cream-100 text-bakery-700">
        <Wrench className="size-6" />
      </span>

      <h1 className="mt-6 font-heading text-2xl font-bold text-foreground sm:text-3xl">
        {siteName} is closed for maintenance
      </h1>

      <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
        {message}
      </p>

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="size-3.5" />
        Please check back shortly.
      </p>
    </main>
  );
}
