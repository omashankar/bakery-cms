import {
  ProductGridSkeleton,
  StoreHeaderSkeleton,
  StoreLoadingShell,
} from "@/components/shared/storefront-loading";
import { layoutSpacing } from "@/constants/spacing";

/** Wishlist awaits the catalogue to resolve the saved slugs against it. */
export default function Loading() {
  return (
    <StoreLoadingShell>
      <StoreHeaderSkeleton />
      <div className={`${layoutSpacing.container} py-10`}>
        <ProductGridSkeleton cards={4} />
      </div>
    </StoreLoadingShell>
  );
}
