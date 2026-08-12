import { Skeleton } from "@/components/ui/skeleton";
import {
  ProductGridSkeleton,
  StoreHeaderSkeleton,
  StoreLoadingShell,
} from "@/components/shared/storefront-loading";
import { layoutSpacing } from "@/constants/spacing";

/**
 * Covers /store/collections and /store/collections/[slug].
 *
 * Both await the catalogue AND the shop's categories in the page function
 * before returning any JSX, so this is the heaviest page-level wait on the
 * storefront — and until it resolves the customer is still looking at whatever
 * page they clicked from.
 *
 * Two columns, because that is what arrives: the filter panel and the grid.
 */
export default function Loading() {
  return (
    <StoreLoadingShell>
      <StoreHeaderSkeleton />
      <div className={`${layoutSpacing.container} py-10`}>
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <Skeleton className="hidden h-[28rem] rounded-xl lg:block" />
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Skeleton className="h-9 w-full max-w-md rounded-md" />
              <Skeleton className="h-8 w-40 rounded-md" />
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-24 rounded-full" />
              ))}
            </div>
            <ProductGridSkeleton />
          </div>
        </div>
      </div>
    </StoreLoadingShell>
  );
}
