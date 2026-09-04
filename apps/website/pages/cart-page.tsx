"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, Heart, Lock, Pencil, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckoutProgress } from "@/apps/website/checkout/components/checkout-progress";
import { CouponInput } from "@/apps/website/checkout/components/coupon-input";
import { applyCouponCode, type AppliedCoupon } from "@/features/orders/lib/coupons";
import { getCheckoutDraft, saveCheckoutDraft } from "@/features/orders/lib/checkout-draft";
import { OrderSummaryPanel } from "@/apps/website/checkout/components/order-summary-panel";
import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import {
  validateCartAgainstCatalog,
  type CartIssue,
} from "@/features/orders/lib/cart-validation";
import { ProductRailSection } from "@/apps/website/components/product-rail-section";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import {
  getCommerceSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import {
  addToCart,
  cartLineToAddInput,
  CART_PREFERENCES_UPDATED_EVENT,
  getCartPreferences,
  getCartItems,
  cartLineChoices,
  moveCartItemToSavedForLater,
  removeCartItem,
  restoreSavedItemToCart,
  subscribeToCart,
  updateCartItemQuantity,
  updateCartPreferences,
  type CartLineItem,
  type CartPreferences,
} from "@/features/cart/lib/cart";
import {
  getSavedForLaterItems,
  removeSavedForLaterItem,
  SAVED_FOR_LATER_UPDATED_EVENT,
} from "@/features/cart/lib/saved-for-later";
import { getRecentlyViewedProducts } from "@/apps/website/lib/recently-viewed";
import { addToWishlist } from "@/apps/website/lib/wishlist";
import { hasCustomerSession } from "@/apps/website/account/lib/customer-session";
import { openCustomerAuthModal } from "@/apps/website/account/components/customer-auth-modal";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { LandingProduct } from "@/constants/landing-data";

interface CartPageProps {
  /** The shop's published catalogue, read on the server — see `getRecentlyViewedProducts`. */
  catalog?: LandingProduct[];
}

export function CartPage({ catalog = [] }: CartPageProps) {
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [savedItems, setSavedItems] = useState<CartLineItem[]>([]);
  const [preferences, setPreferences] = useState<CartPreferences>({
    giftWrap: false,
    specialInstructions: "",
  });
  const [commerce, setCommerce] = useState(defaultCommerceSettings);
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  /**
   * The coupon, read from the checkout draft rather than a second store.
   *
   * There is exactly one place a chosen code lives — the sessionStorage
   * checkout draft — and checkout already reads and writes it there. A cart
   * that kept its own copy would be a second source of truth for the one
   * field on the page that changes what the customer pays.
   */
  const [coupon, setCoupon] = useState<AppliedCoupon | undefined>(undefined);
  const labels = useBusinessLabels();

  function refresh() {
    setItems(getCartItems());
    setSavedItems(getSavedForLaterItems());
    setPreferences(getCartPreferences());
    setCommerce(getCommerceSettings());
    setSignedIn(hasCustomerSession());
    setCoupon(getCheckoutDraft().coupon);
  }

  useEffect(() => {
    refresh();
    setLoaded(true);

    // subscribeToCart also listens for the browser storage event, so a cart
    // edited in another tab is reflected here too.
    const unsubscribeCart = subscribeToCart(refresh);
    window.addEventListener(SAVED_FOR_LATER_UPDATED_EVENT, refresh);
    window.addEventListener(CART_PREFERENCES_UPDATED_EVENT, refresh);
    window.addEventListener(SETTINGS_UPDATED_EVENT, refresh);
    window.addEventListener("bakery-customer-session-updated", refresh);

    return () => {
      unsubscribeCart();
      window.removeEventListener(SAVED_FOR_LATER_UPDATED_EVENT, refresh);
      window.removeEventListener(CART_PREFERENCES_UPDATED_EVENT, refresh);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refresh);
      window.removeEventListener("bakery-customer-session-updated", refresh);
    };
  }, []);


  /**
   * The same number the navbar badge shows, which is total QUANTITY — two of
   * one thing is two items to a customer. Counting lines instead would give
   * the header and the page two different answers about one cart.
   */
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  /**
   * Lines the shop can no longer fulfil, checked against the catalogue the
   * SERVER sent.
   *
   * `validateCartAgainstCatalog` was written for this and the cart never
   * called it, so a product deleted or taken out of stock after it was added
   * sat in the cart looking perfectly orderable until checkout refused it.
   *
   * Skipped entirely when the catalogue is empty. Empty means “we were not
   * told” — the prop defaults to `[]` — and answering that with “nothing you
   * have is available” would condemn every line in the cart.
   */
  const issuesBySlug = useMemo(() => {
    if (catalog.length === 0) return new Map<string, CartIssue>();
    return new Map(
      validateCartAgainstCatalog(items, catalog).map((issue) => [issue.productSlug, issue]),
    );
  }, [items, catalog]);

  /**
   * What the shop says these lines normally cost, less what it is charging.
   *
   * Only lines the SHOP gave a compare-at for count — `compareAtPrice` is
   * absent unless an owner typed one above their own base price. A savings
   * figure computed from anything else is a claim about the past that nobody
   * made.
   */
  const savings = items.reduce(
    (sum, item) =>
      sum +
      (item.compareAtPrice && item.compareAtPrice > item.price
        ? (item.compareAtPrice - item.price) * item.quantity
        : 0),
    0,
  );

  /**
   * Re-checked on every render, never trusted as stored.
   *
   * A coupon is validated against the cart it was applied to, and carts get
   * edited: remove a line and a “₹200 off orders over ₹1,500” stops holding.
   * Carrying the frozen discount would subtract money the shop never agreed
   * to, and `Math.max(total, 0)` would quietly floor the damage at zero
   * instead of showing it.
   */
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const couponCheck = useMemo(
    () => (coupon ? applyCouponCode(coupon.code, subtotal) : null),
    [coupon, subtotal],
  );
  const validCoupon = couponCheck?.ok ? couponCheck.coupon : null;
  const couponLapsedReason = couponCheck && !couponCheck.ok ? couponCheck.message : null;

  function applyCoupon(next: AppliedCoupon | undefined) {
    setCoupon(next);
    saveCheckoutDraft({ ...getCheckoutDraft(), coupon: next });
  }

  const totals = useMemo(    () =>
      calculateCartTotals({
        items,
        // The discount the coupon is worth for THIS cart, not the one it was
        // worth when it was applied.
        discount: validCoupon?.discountAmount ?? 0,
        giftWrap: preferences.giftWrap,
        commerceOverride: commerce,
      }),
    [items, validCoupon?.discountAmount, preferences.giftWrap, commerce]
  );

  const recentlyViewed = useMemo(
    () => getRecentlyViewedProducts(catalog),
    [catalog, loaded, items.length], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleSaveForLater(item: CartLineItem) {
    if (moveCartItemToSavedForLater(item.id)) {
      toast.success("Moved to saved for later");
    }
  }

  function handleMoveToWishlist(item: CartLineItem) {
    const added = addToWishlist(item.productSlug);
    removeCartItem(item.id);
    toast.success(
      added ? "Moved to wishlist" : "Removed from cart — it was already in your wishlist"
    );
  }

  // Removing was the one irreversible action with no feedback at all, while
  // every reversible one toasted. Confirm it, and offer the way back.
  function handleRemoveItem(item: CartLineItem) {
    removeCartItem(item.id);
    toast.success("Removed " + item.name, {
      action: {
        label: "Undo",
        onClick: () => {
          // Every field, from the one list that has them all. Written out here
          // by hand, this rebuild dropped the uploaded photo — so a photo cake
          // came back with nothing for the baker to print.
          addToCart(cartLineToAddInput(item));
          toast.success("Item restored");
        },
      },
    });
  }

  function handleRestoreSaved(savedId: string) {
    if (restoreSavedItemToCart(savedId)) {
      toast.success("Moved back to cart");
    }
  }

  return (
    <>
      <StorePageHeader
        title={itemCount > 0 ? `Shopping Cart (${itemCount})` : "Shopping Cart"}
        description="Review your items, gift options, and saved picks before checkout."
        breadcrumbs={[{ label: "Cart" }]}
      />

      {/* `pb-24` on a phone: the sticky checkout bar sits over the last of it. */}
      <section className={cn(layoutSpacing.sectionY, "pb-28 lg:pb-16")}>
        <div className={layoutSpacing.container}>
          {!loaded ? (
            // The cart lives in this browser, so the server has nothing to
            // render. Mirror the real layout rather than showing one grey slab,
            // so the page does not visibly jump when the data arrives.
            <div className="grid gap-8 lg:grid-cols-[1fr_320px]" aria-hidden>
              <div className="space-y-4">
                {[0, 1].map((row) => (
                  <div
                    key={row}
                    className="flex gap-4 rounded-xl border border-border bg-white p-4"
                  >
                    <div className="size-20 shrink-0 animate-pulse rounded-lg bg-cream-100" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 w-2/5 animate-pulse rounded bg-cream-100" />
                      <div className="h-3 w-1/4 animate-pulse rounded bg-cream-100" />
                      <div className="h-8 w-28 animate-pulse rounded-lg bg-cream-100" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-64 animate-pulse rounded-xl border border-border bg-cream-50" />
            </div>
          ) : items.length === 0 ? (
            <div className="space-y-10">
              <EmptyState
                className="border-border bg-cream-50"
                icon={ShoppingBag}
                title="Your cart is empty"
                description={`Browse our ${labels.productWordPlural.toLowerCase()} and add your favourites.`}
                action={
                  <Button variant="bakery" render={<Link href={routes.store.collections} />}>
                    {`Browse ${labels.productWordPlural}`}
                  </Button>
                }
              />
              {savedItems.length > 0 ? (
                <SavedForLaterSection
                  items={savedItems}
                  onRestore={handleRestoreSaved}
                  onRemove={removeSavedForLaterItem}
                />
              ) : null}
              {recentlyViewed.length > 0 ? (
                <ProductRailSection
                  title="Recently viewed"
                  description="Pick up where you left off."
                  cakes={recentlyViewed.slice(0, 4)}
                />
              ) : null}
            </div>
          ) : (
            <div className="space-y-8">
              {/*
                The cart IS a step, and the bar that says so started at
                Delivery — so the screen a customer spends longest on showed no
                progress, and the first thing the next screen told them was
                that they were at the beginning.

                Only here, never in the empty branch: a progress bar over an
                empty cart implies a checkout that is not happening.
              */}
              <CheckoutProgress currentStep={0} className="mx-auto max-w-2xl" />

              <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
              <div className="order-1 space-y-6 lg:order-none lg:col-start-1">
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border bg-white p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-4">
                          <Link
                            href={routes.store.cake(item.productSlug)}
                            className="size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-cream-100"
                          >
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image}
                                alt={item.name}
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                          </Link>
                          <div className="min-w-0 space-y-1">
                          <Link
                            href={routes.store.cake(item.productSlug)}
                            className="font-medium hover:text-bakery-700"
                          >
                            {item.name}
                          </Link>
                          {/* One list, so this cannot drift from the invoice again. */}
                          {cartLineChoices(item).length > 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {cartLineChoices(item).join(" · ")}
                            </p>
                          ) : null}
                          {item.message ? (
                            <p className="text-sm text-muted-foreground">
                              Message: &quot;{item.message}&quot;
                            </p>
                          ) : null}
                          {item.deliveryDate ? (
                            <p className="text-xs text-muted-foreground">
                              Delivery: {item.deliveryDate}
                              {item.deliveryTime ? ` · ${item.deliveryTime}` : ""}
                            </p>
                          ) : null}
                          {/*
                            The photo the customer uploaded. The line has carried
                            it since the day photo uploads shipped and no screen
                            before the invoice ever showed it back — so the one
                            thing a customer most wants to check before paying was
                            the one thing they could not.
                          */}
                          {item.photoUrl ? (
                            <span className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                              <span className="size-10 shrink-0 overflow-hidden rounded border border-border bg-cream-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.photoUrl}
                                  alt=""
                                  className="size-full object-cover"
                                  loading="lazy"
                                />
                              </span>
                              Your photo, to be printed on it
                            </span>
                          ) : null}
                          {issuesBySlug.get(item.productSlug) ? (
                            <p className="pt-1 text-xs font-medium text-destructive">
                              {issuesBySlug.get(item.productSlug)?.message}
                            </p>
                          ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end sm:gap-4">
                          <QuantityStepper
                            value={item.quantity}
                            onChange={(value) => updateCartItemQuantity(item.id, value)}
                          />
                          <div className="sm:min-w-28 sm:text-right">
                            <p className="font-semibold">
                              {formatCurrency(item.price * item.quantity)}
                            </p>
                            {/*
                              The shop’s own compare-at, stamped on the line when
                              it was added — the cart holds lines rather than
                              products, and the catalogue it is handed carries a
                              price already shifted by every default option, so
                              recomputing here would strike a different number
                              from the one the customer was shown.
                            */}
                            {item.compareAtPrice && item.compareAtPrice > item.price ? (
                              <p className="text-xs text-muted-foreground">
                                <span className="line-through">
                                  {formatCurrency(item.compareAtPrice * item.quantity)}
                                </span>{" "}
                                <span className="font-medium text-bakery-700">
                                  {Math.round((1 - item.price / item.compareAtPrice) * 100)}% off
                                </span>
                              </p>
                            ) : null}
                            {item.quantity > 1 ? (
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(item.price)} each
                              </p>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemoveItem(item)}
                            aria-label="Remove item"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                        {/*
                          Back to the product page with THIS line’s choices
                          already made, and adding again replaces it rather than
                          leaving a near-identical second line behind —
                          `cartLineId` folds the choices into a line’s identity,
                          so changing one necessarily makes a new line.
                        */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          render={
                            <Link
                              href={`${routes.store.cake(item.productSlug)}?line=${encodeURIComponent(item.id)}`}
                            />
                          }
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSaveForLater(item)}
                        >
                          <Bookmark className="size-4" />
                          Save for later
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleMoveToWishlist(item)}
                        >
                          <Heart className="size-4" />
                          Move to wishlist
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-border bg-cream-50 p-4">
                  <p className="text-sm font-medium">Order extras</p>
                  {commerce.giftWrapEnabled ? (
                    <label className="mt-3 flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={preferences.giftWrap}
                        onCheckedChange={(checked) =>
                          updateCartPreferences({ giftWrap: checked === true })
                        }
                      />
                      <span>
                        <span className="font-medium">{commerce.giftWrapLabel}</span>
                        <span className="block text-muted-foreground">
                          Premium box and ribbon · {formatCurrency(commerce.giftWrapFee)}
                        </span>
                      </span>
                    </label>
                  ) : null}
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="special-instructions">Special instructions</Label>
                    <Textarea
                      id="special-instructions"
                      rows={3}
                      placeholder="Delivery notes, allergy reminders, or celebration details..."
                      value={preferences.specialInstructions}
                      onChange={(event) =>
                        updateCartPreferences({ specialInstructions: event.target.value })
                      }
                    />
                  </div>
                </div>

                {savedItems.length > 0 ? (
                  <SavedForLaterSection
                    items={savedItems}
                    onRestore={handleRestoreSaved}
                    onRemove={removeSavedForLaterItem}
                  />
                ) : null}

                {recentlyViewed.length > 0 ? (
                  <ProductRailSection
                    title="Recently viewed"
                    description="You might also want to add these."
                    cakes={recentlyViewed.slice(0, 4)}
                  />
                ) : null}
              </div>

              <div className="order-2 space-y-4 lg:order-none lg:col-start-2 lg:sticky lg:top-24 lg:self-start">
                {/*
                  The SAME component checkout uses, writing to the same draft.
                  A coupon box of its own here would be a second coupon system
                  on the one screen where the customer decides what to pay.
                */}
                <div className="rounded-xl border border-border bg-white p-4">
                  <p className="mb-3 text-sm font-medium">Have a coupon?</p>
                  <CouponInput
                    subtotal={subtotal}
                    applied={coupon}
                    lapsedReason={couponLapsedReason}
                    onApply={applyCoupon}
                    onRemove={() => applyCoupon(undefined)}
                  />
                </div>
                <OrderSummaryPanel
                  items={items}
                  totals={totals}
                  showEditLink={false}
                  giftWrapLabel={commerce.giftWrapLabel}
                />
                {/*
                  Only from compare-at prices the SHOP typed. Absent otherwise,
                  because a saving computed from anything else is a claim about
                  the past that nobody made — the same rule that had an invented
                  MRP taken out of the repository.
                */}
                {savings > 0 ? (
                  <p className="text-center text-sm font-medium text-bakery-700">
                    You save {formatCurrency(savings)} on this order
                  </p>
                ) : null}
                <Button
                  className="w-full"
                  variant="bakery"
                  {...(signedIn
                    ? { render: <Link href={routes.store.checkout} /> }
                    : { onClick: () => openCustomerAuthModal("phone") })}
                >
                  {signedIn ? null : <Lock className="size-4" />}
                  Proceed to checkout
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  render={<Link href={routes.store.collections} />}
                >
                  Continue shopping
                </Button>
              </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/*
        The total and the way forward, always reachable on a phone.

        The summary is `lg:sticky` in the right-hand column, which does nothing
        below that breakpoint: on a phone it sits at the very bottom, under the
        lines, the extras, saved-for-later and a rail of recently viewed. A
        customer scrolling their cart could not see what it came to, or get to
        checkout, without scrolling to the end of the page.

        Rendered only with a cart to check out, and hidden on lg where the real
        summary is already pinned. `pb-24` on the section leaves room for it.
      */}
      {loaded && items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white p-4 lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{formatCurrency(totals.total)}</p>
              {savings > 0 ? (
                <p className="truncate text-xs font-medium text-bakery-700">
                  You save {formatCurrency(savings)}
                </p>
              ) : null}
            </div>
            <Button
              className="flex-1"
              variant="bakery"
              {...(signedIn
                ? { render: <Link href={routes.store.checkout} /> }
                : { onClick: () => openCustomerAuthModal("phone") })}
            >
              {signedIn ? null : <Lock className="size-4" />}
              Proceed to checkout
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SavedForLaterSection({
  items,
  onRestore,
  onRemove,
}: {
  items: CartLineItem[];
  onRestore: (savedId: string) => void;
  onRemove: (savedId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-4">
        <h2 className="font-heading text-lg font-semibold">Saved for later</h2>
        <p className="text-sm text-muted-foreground">
          Items you saved without losing your customization.
        </p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium">{item.name}</p>
              {/* Saved for later, and it must say the same thing the cart said. */}
              {cartLineChoices(item).length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {cartLineChoices(item).join(" · ")}
                </p>
              ) : null}
              <p className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onRestore(item.id)}>
                Move to cart
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onRemove(item.id)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
