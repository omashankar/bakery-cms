import { Skeleton } from "@/components/ui/skeleton";
import {
  ProductGridSkeleton,
  StoreLoadingShell,
} from "@/components/shared/storefront-loading";
import { layoutSpacing } from "@/constants/spacing";

/**
 * A cake's own page, which awaits `getProductBySlug` and the site identity.
 *
 * Its own shape rather than the shared one: a gallery beside a details column
 * is nothing like a grid of cards, and a skeleton that does not match what
 * lands is a layout jump dressed up as polish.
 */
export default function Loading() {
  return (
    <StoreLoadingShell>
      <div className={`${layoutSpacing.container} py-8`}>
        <Skeleton className="h-3.5 w-56" />

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="size-20 rounded-lg" />
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-24 rounded-lg" />
                ))}
              </div>
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>

        <div className="mt-14 space-y-6">
          <Skeleton className="h-7 w-56" />
          <ProductGridSkeleton cards={3} />
        </div>
      </div>
    </StoreLoadingShell>
  );
}
