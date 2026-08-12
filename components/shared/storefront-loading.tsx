import { Skeleton } from "@/components/ui/skeleton";
import { layoutSpacing } from "@/constants/spacing";

/**
 * The pieces the storefront's `loading.tsx` files are built from.
 *
 * No route in the app had one. What these cover is the PAGE's own awaits:
 * `/store/collections` awaits the catalogue and the shop's categories,
 * `/store/search` and `/store/wishlist` await the catalogue, `/store/cakes/[slug]`
 * awaits the product. Until that resolves, a customer who clicked a link sits on
 * the PREVIOUS page with nothing to say another is coming.
 *
 * Two things this does NOT cover, both worth stating so the next person does not
 * expect it to:
 *
 * - The storefront LAYOUT's awaits (maintenance state, chrome, scripts, SEO).
 *   `loading.tsx` nests inside `layout.tsx` — "loading.js will be nested inside
 *   layout.js … and any children below" (next/dist/docs, loading.md) — so it can
 *   never wrap the layout's own work. It does not need to: layouts are not
 *   re-executed on client-side navigation within their segment (Partial
 *   Rendering), so those reads happen once per full page load, not per click.
 * - Any timing measured with `curl`. That is a full document request and includes
 *   the layout, so it overstates what a customer feels moving between pages.
 *
 * The Suspense boundaries that already exist do not help either: in
 * `/store/search` the `await` runs in the page function BEFORE the boundary is
 * returned, so that fallback only exists to satisfy `useSearchParams`.
 *
 * Shaped to match what replaces them, so the layout does not jump.
 */

/** Mirrors `StorePageHeader`: bordered cream band, breadcrumb, title, blurb. */
export function StoreHeaderSkeleton() {
  return (
    <div className="border-b border-border bg-cream-100">
      <div className={`${layoutSpacing.container} py-8 sm:py-10`}>
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="mt-4 h-9 w-64 sm:h-10 sm:w-80" />
        <Skeleton className="mt-3 h-4 w-full max-w-md" />
      </div>
    </div>
  );
}

/** Mirrors `ProductCard`: square image, category, name, price, button. */
export function ProductGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
          <Skeleton className="aspect-square rounded-none" />
          <div className="space-y-3 p-3.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Wraps a loading screen so assistive technology is told what is happening —
 * a shimmer says nothing to a screen reader.
 */
export function StoreLoadingShell({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}
