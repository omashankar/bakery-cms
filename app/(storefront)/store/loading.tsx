import { Skeleton } from "@/components/ui/skeleton";
import {
  StoreHeaderSkeleton,
  StoreLoadingShell,
} from "@/components/shared/storefront-loading";
import { layoutSpacing } from "@/constants/spacing";

/**
 * The fallback for every /store page that does not have a closer one, including
 * the storefront home — which awaits the homepage sections, the product rails,
 * banners, testimonials, FAQs, coupons and the store location before it renders.
 *
 * Deliberately shape-neutral — a header band and a couple of content blocks —
 * because the pages it covers differ (contact, FAQ, gallery, terms). The routes
 * with a distinctive shape carry their own `loading.tsx` alongside this.
 */
export default function Loading() {
  return (
    <StoreLoadingShell>
      <StoreHeaderSkeleton />
      <div className={`${layoutSpacing.container} space-y-4 py-10`}>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    </StoreLoadingShell>
  );
}
