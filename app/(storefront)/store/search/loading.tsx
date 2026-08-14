import { Skeleton } from "@/components/ui/skeleton";
import {
  ProductGridSkeleton,
  StoreHeaderSkeleton,
  StoreLoadingShell,
} from "@/components/shared/storefront-loading";
import { layoutSpacing } from "@/constants/spacing";

/**
 * Search awaits the whole catalogue before it returns any JSX.
 *
 * The page already has a Suspense boundary, but it cannot cover this: the
 * `await` runs in the page function BEFORE the boundary is returned, so that
 * fallback only exists to satisfy `useSearchParams` in the client component.
 */
export default function Loading() {
  return (
    <StoreLoadingShell>
      <StoreHeaderSkeleton />
      <div className={`${layoutSpacing.container} space-y-6 py-10`}>
        <Skeleton className="h-10 w-full max-w-xl rounded-md" />
        <Skeleton className="h-4 w-40" />
        <ProductGridSkeleton />
      </div>
    </StoreLoadingShell>
  );
}
