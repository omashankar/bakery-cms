"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, Heart, Lock, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OrderSummaryPanel } from "@/features/storefront/checkout/components/order-summary-panel";
import { calculateCartTotals } from "@/features/storefront/checkout/lib/cart-totals";
import { ProductRailSection } from "@/features/storefront/components/product-rail-section";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import {
  getCommerceSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/admin/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/admin/settings/lib/settings-utils";
import {
  CART_PREFERENCES_UPDATED_EVENT,
  getCartPreferences,
  getCartItems,
  moveCartItemToSavedForLater,
  removeCartItem,
  restoreSavedItemToCart,
  updateCartItemQuantity,
  updateCartPreferences,
  type CartLineItem,
  type CartPreferences,
} from "@/features/storefront/lib/cart";
import {
  getSavedForLaterItems,
  removeSavedForLaterItem,
  SAVED_FOR_LATER_UPDATED_EVENT,
} from "@/features/storefront/lib/saved-for-later";
import { getRecentlyViewedCakes } from "@/features/storefront/lib/recently-viewed";
import { addToWishlist } from "@/features/storefront/lib/wishlist";
import { hasCustomerSession } from "@/features/storefront/account/lib/customer-session";
import { openCustomerAuthModal } from "@/features/storefront/account/components/customer-auth-modal";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency } from "@/utils/format";

export function CartPage() {
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [savedItems, setSavedItems] = useState<CartLineItem[]>([]);
  const [preferences, setPreferences] = useState<CartPreferences>({
    giftWrap: false,
    specialInstructions: "",
  });
  const [commerce, setCommerce] = useState(defaultCommerceSettings);
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  function refresh() {
    setItems(getCartItems());
    setSavedItems(getSavedForLaterItems());
    setPreferences(getCartPreferences());
    setCommerce(getCommerceSettings());
    setSignedIn(hasCustomerSession());
  }

  useEffect(() => {
    refresh();
    setLoaded(true);

    window.addEventListener("bakery-cart-updated", refresh);
    window.addEventListener(SAVED_FOR_LATER_UPDATED_EVENT, refresh);
    window.addEventListener(CART_PREFERENCES_UPDATED_EVENT, refresh);
    window.addEventListener(SETTINGS_UPDATED_EVENT, refresh);
    window.addEventListener("bakery-customer-session-updated", refresh);

    return () => {
      window.removeEventListener("bakery-cart-updated", refresh);
      window.removeEventListener(SAVED_FOR_LATER_UPDATED_EVENT, refresh);
      window.removeEventListener(CART_PREFERENCES_UPDATED_EVENT, refresh);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refresh);
      window.removeEventListener("bakery-customer-session-updated", refresh);
    };
  }, []);

  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Cart requires login — pop the login modal open automatically for guests.
  useEffect(() => {
    if (loaded && !signedIn) {
      openCustomerAuthModal("phone");
    }
  }, [loaded, signedIn]);

  const totals = useMemo(
    () =>
      calculateCartTotals({
        items,
        giftWrap: preferences.giftWrap,
        commerceOverride: commerce,
      }),
    [items, preferences.giftWrap, commerce]
  );

  const recentlyViewed = useMemo(() => getRecentlyViewedCakes(), [loaded, items.length]);

  function handleSaveForLater(item: CartLineItem) {
    if (moveCartItemToSavedForLater(item.id)) {
      toast.success("Moved to saved for later");
    }
  }

  function handleMoveToWishlist(item: CartLineItem) {
    const added = addToWishlist(item.cakeSlug);
    removeCartItem(item.id);
    toast.success(added ? "Moved to wishlist" : "Already in wishlist — removed from cart");
  }

  function handleRestoreSaved(savedId: string) {
    if (restoreSavedItemToCart(savedId)) {
      toast.success("Moved back to cart");
    }
  }

  return (
    <>
      <StorePageHeader
        title="Shopping Cart"
        description="Review your items, gift options, and saved picks before checkout."
        breadcrumbs={[{ label: "Cart" }]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          {!loaded ? (
            <div className="h-40 animate-pulse rounded-xl border border-border bg-cream-100" />
          ) : !signedIn ? (
            <div className="mx-auto max-w-sm py-12 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-cream-100">
                <Lock className="size-5 text-bakery-700" />
              </div>
              <p className="mt-4 font-heading text-lg font-bold text-foreground">
                Login to view your cart
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {cartItemCount > 0
                  ? `Your ${cartItemCount} item${cartItemCount === 1 ? "" : "s"} ${cartItemCount === 1 ? "is" : "are"} saved — sign in to continue.`
                  : "Sign in to see your saved items."}
              </p>
              <Button
                variant="bakery"
                className="mt-4"
                onClick={() => openCustomerAuthModal("phone")}
              >
                <Lock className="size-4" />
                Login to continue
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="space-y-10">
              <EmptyState
                className="border-border bg-cream-50"
                icon={ShoppingBag}
                title="Your cart is empty"
                description="Browse our delicious cakes and add your favourites."
                action={
                  <Button variant="bakery" render={<Link href={routes.store.collections} />}>
                    Browse Cakes
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
            <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
              <div className="order-2 space-y-6 lg:order-none lg:col-start-1">
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border bg-white p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-4">
                          <Link
                            href={routes.store.cake(item.cakeSlug)}
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
                            href={routes.store.cake(item.cakeSlug)}
                            className="font-medium hover:text-bakery-700"
                          >
                            {item.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {[item.weight, item.flavour, item.shape].filter(Boolean).join(" · ")}
                          </p>
                          {item.variantSummary?.length ? (
                            <p className="text-sm text-muted-foreground">
                              {item.variantSummary.join(" · ")}
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
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end sm:gap-4">
                          <QuantityStepper
                            value={item.quantity}
                            onChange={(value) => updateCartItemQuantity(item.id, value)}
                          />
                          <p className="font-semibold sm:min-w-20 sm:text-right">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeCartItem(item.id)}
                            aria-label="Remove item"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
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

              <div className="order-1 space-y-4 lg:order-none lg:col-start-2 lg:sticky lg:top-24 lg:self-start">
                <OrderSummaryPanel
                  items={items}
                  totals={totals}
                  showEditLink={false}
                  giftWrapLabel={commerce.giftWrapLabel}
                />
                <Button
                  className="w-full"
                  variant="bakery"
                  render={<Link href={routes.store.checkout} />}
                >
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
          )}
        </div>
      </section>
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
              <p className="text-sm text-muted-foreground">
                {[item.weight, item.flavour, item.shape].filter(Boolean).join(" · ")}
              </p>
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
