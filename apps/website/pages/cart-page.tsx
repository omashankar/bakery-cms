"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  Heart,
  Pencil,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "@/lib/lazy-toast";
import {
  DELIVERY_LOCATION_UPDATED_EVENT,
  readDeliveryLocation,
} from "@/features/commerce/lib/delivery-location";
import { EmptyState } from "@/components/shared/empty-state";
import { OptimizedImage } from "@/components/shared/optimized-image";
import { EarliestDelivery } from "@/components/storefront/earliest-delivery";
import { PincodeCheck } from "@/components/storefront/pincode-check";
import { fetchPincodePlace } from "@/features/commerce/lib/pincode-api";
import type { PincodePlace } from "@/types/delivery";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { FrameThumbnail } from "@/components/storefront/frame-thumbnail";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CartCouponPanel } from "@/apps/website/checkout/components/cart-coupon-panel";
import { publishCheckoutStep } from "@/apps/website/checkout/lib/checkout-step-store";
import { applyCouponCode, type AppliedCoupon } from "@/features/orders/lib/coupons";
import { offersForCart } from "@/features/commerce/lib/coupon-offers";
import {
  getActiveCoupons,
  type StoredCoupon,
} from "@/features/commerce/lib/coupons-repository";
import { getFreeDeliveryThreshold } from "@/features/orders/lib/cart-totals";
import { getDeliveryPromise } from "@/apps/website/lib/product-details";
import { getCheckoutDraft, saveCheckoutDraft } from "@/features/orders/lib/checkout-draft";
import { OrderSummaryPanel } from "@/apps/website/checkout/components/order-summary-panel";
import { calculateCartTotals, compareAtSavings } from "@/features/orders/lib/cart-totals";
import {
  validateCartAgainstCatalog,
  type CartIssue,
} from "@/features/orders/lib/cart-validation";
import { ProductRailSection } from "@/apps/website/components/product-rail-section";
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
import { getRecentlyViewedProducts } from "@/features/products/lib/recently-viewed";
import { addToWishlist } from "@/apps/website/lib/wishlist";
import { hasCustomerSession } from "@/apps/website/account/lib/customer-session";
import { openCustomerAuthModal } from "@/apps/website/account/lib/auth-modal-events";
import { routes } from "@/constants/routes";
import { storefrontHeading } from "@/constants/typography";
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
  /**
   * The shop's live coupons, read in `refresh` beside every other store.
   *
   * Not read during render: `getActiveCoupons` seeds localStorage and fires an
   * event on a cold cache, and a render that writes is a render that can
   * schedule its own next one. `refresh` already runs on mount and on every
   * settings, cart and session event, which is exactly when this can change.
   */
  const [liveCoupons, setLiveCoupons] = useState<StoredCoupon[]>([]);
  const labels = useBusinessLabels();

  function refresh() {
    setItems(getCartItems());
    setSavedItems(getSavedForLaterItems());
    setPreferences(getCartPreferences());
    setCommerce(getCommerceSettings());
    setSignedIn(hasCustomerSession());
    setCoupon(getCheckoutDraft().coupon);
    setLiveCoupons(getActiveCoupons());
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
  const savings = compareAtSavings(items);

  /**
   * Re-checked on every render, never trusted as stored.
   *
   * A coupon is validated against the cart it was applied to, and carts get
   * edited: remove a line and a “₹200 off orders over ₹1,500” stops holding.
   * Carrying the frozen discount would subtract money the shop never agreed
   * to, and `Math.max(total, 0)` would quietly floor the damage at zero
   * instead of showing it.
   */
  /*
    A `subtotal` stood here and fed the coupon check and the offer list. Both
    take the LINES now — a scoped coupon cannot tell plants from cake given one
    number — and nothing else on this page read it, so it is gone rather than
    left as the obvious wrong argument for the next person to pass.
  */
  /**
   * The cart as a COUPON sees it: one entry per line, carrying every category
   * the product is filed under.
   *
   * A coupon can be scoped now — "20% off plants" takes 20% of the plants in
   * this basket and nothing off the cake beside them — and a bare subtotal
   * cannot express which line is which. The ids come off the catalogue the
   * server already sent for the stock check above; a line whose product is not
   * in it gets no categories, so a scoped coupon simply will not match it.
   */
  const couponLines = useMemo(() => {
    const bySlug = new Map(catalog.map((product) => [product.slug, product.categoryIds ?? []]));
    return items.map((item) => ({
      productSlug: item.productSlug,
      categoryIds: bySlug.get(item.productSlug) ?? [],
      price: item.price,
      quantity: item.quantity,
    }));
  }, [items, catalog]);
  /**
   * Which outline each line's photograph was fitted to.
   *
   * Off the catalogue the server already sends for the stock check, NOT off a
   * new field on the cart line: a line carries its photo as a URL and nothing
   * else, and every extra thing it carries has to be threaded by hand through
   * the quote, the order, the invoice and half a dozen lists between here and
   * a saved order. A slug and a catalogue answer the same question for free.
   *
   * A line whose product is not in the catalogue — or a page that was sent no
   * catalogue at all — gets `undefined`, which is the round frame every photo
   * product used before there was a choice.
   */
  const frameBySlug = useMemo(
    () => new Map(catalog.map((product) => [product.slug, product.photoFrameShape])),
    [catalog],
  );

  const couponCheck = useMemo(
    () => (coupon ? applyCouponCode(coupon.code, couponLines) : null),
    [coupon, couponLines],
  );
  const validCoupon = couponCheck?.ok ? couponCheck.coupon : null;
  const couponLapsedReason = couponCheck && !couponCheck.ok ? couponCheck.message : null;

  function applyCoupon(next: AppliedCoupon | undefined) {
    setCoupon(next);
    saveCheckoutDraft({ ...getCheckoutDraft(), coupon: next });
  }

  /**
   * Offers this basket has not taken yet, with what each still needs.
   *
   * Read from the same coupon store the box below applies from, so the page
   * cannot advertise a code its own input would refuse. Empty is the common
   * answer — every coupon this install ships is inactive until an owner turns
   * it on — and an empty list renders nothing at all.
   */
  const offers = useMemo(
    () => offersForCart(liveCoupons, couponLines, { exclude: coupon?.code }),
    [liveCoupons, couponLines, coupon?.code],
  );

  /**
   * What the shop has actually promised, in its own settings.
   *
   * Not a strip of badges. Every row is a value an owner typed or a rule they
   * configured, and a row with nothing behind it does not render — the product
   * page’s own trust rows were rewritten to that standard after one of them
   * printed a fallback as a fact under every product in the shop.
   */
  // The header draws the steps; over an EMPTY cart it should draw none.
  useEffect(() => {
    publishCheckoutStep(loaded && items.length === 0 ? { step: 0, hidden: true } : { step: 0 });
  }, [loaded, items.length]);
  useEffect(() => () => publishCheckoutStep(null), []);

  const promise = loaded ? getDeliveryPromise() : "";
  const freeDeliveryOver = loaded ? getFreeDeliveryThreshold() : 0;

  /**
   * THE PINCODE THE BUYER ALREADY GAVE THE HEADER.
   *
   * Without it the cart prices delivery with no address — no zone can
   * match, so it uses the flat fallback — while the checkout one click
   * later prices it against the zone. On a basket under the free-delivery
   * threshold that moves the Delivery row and the Total while the buyer is
   * typing their address, with only a zone name in small text to explain
   * it.
   *
   * Read on mount rather than during render, because `readDeliveryLocation`
   * reads the browser and a render-time call would differ between the
   * server's HTML and the first client render. The header's button
   * announces every change on `DELIVERY_LOCATION_UPDATED_EVENT`, and that
   * button is in the header on this page.
   */
  const [deliveryPincode, setDeliveryPincode] = useState("");
  useEffect(() => {
    const sync = () => setDeliveryPincode(readDeliveryLocation()?.pincode ?? "");
    sync();
    window.addEventListener(DELIVERY_LOCATION_UPDATED_EVENT, sync);
    return () => window.removeEventListener(DELIVERY_LOCATION_UPDATED_EVENT, sync);
  }, []);

  // Where that PIN really is (India Post), so a district or state zone prices
  // this row as the server will at checkout.
  const [deliveryPlace, setDeliveryPlace] = useState<{ code: string; place: PincodePlace | null } | null>(null);
  useEffect(() => {
    if (!deliveryPincode) return;
    let alive = true;
    void fetchPincodePlace(deliveryPincode).then((answer) => {
      if (alive && answer) setDeliveryPlace({ code: deliveryPincode, place: answer.place });
    });
    return () => {
      alive = false;
    };
  }, [deliveryPincode]);
  const place = deliveryPlace?.code === deliveryPincode ? deliveryPlace.place : undefined;

  const totals = useMemo(    () =>
      calculateCartTotals({
        items,
        // The discount the coupon is worth for THIS cart, not the one it was
        // worth when it was applied.
        discount: validCoupon?.discountAmount ?? 0,
        giftWrap: preferences.giftWrap,
        // The same basis the checkout uses, so the Delivery row does not
        // move between the two screens.
        deliveryAddress: deliveryPincode ? { pincode: deliveryPincode, place } : undefined,
        commerceOverride: commerce,
      }),
    [items, validCoupon?.discountAmount, preferences.giftWrap, deliveryPincode, place, commerce]
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
      {/*
        No breadcrumb: the focused header has the way home and the reference
        opens its cart on the heading. The visible h1 sits beside the steps
        once there are lines; until then (loading, or empty) this one is for
        screen readers only, so nothing appears and then vanishes.
      */}
      {itemCount > 0 ? null : <h1 className="sr-only">Shopping Cart</h1>}

      {/* `pb-24` on a phone: the sticky checkout bar sits over the last of it. */}
      <section className={cn(layoutSpacing.sectionY, "pb-28 lg:pb-16")}>
        <div className={layoutSpacing.container}>
          {!loaded ? (
            // The cart lives in this browser, so the server has nothing to
            // render. Mirror the real layout rather than showing one grey slab,
            // so the page does not visibly jump when the data arrives.
            <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" aria-hidden>
              <div className="space-y-4">
                {[0, 1].map((row) => (
                  <div
                    key={row}
                    className="flex gap-4 rounded-xl border border-border bg-card p-4"
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
              {/*
                The steps are in the header now, as the reference has them;
                the page opens on its own heading.
              */}
              <h1 className="font-heading text-xl font-bold tracking-tight">
                Shopping Cart ({itemCount})
              </h1>

              <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="order-1 space-y-6 lg:order-none lg:col-start-1">
                {/*
                  WHERE IT IS GOING, before anything else — the reference's
                  "Deliver to 324001 / Change pincode" bar. The same check as
                  the product page, so a customer outside every zone finds
                  out here and not at the address step.
                */}
                <PincodeCheck
                  inline
                  title="Enter delivery PIN code:"
                  className="rounded-xl border border-border bg-card px-4 py-3"
                />
                <div className="space-y-4">
                  {items.map((item) => (
                    /*
                      LAID OUT LIKE THE REFERENCE'S CART LINE: a picture large
                      enough to recognise, the name with the price level with
                      it on the right, the choices under the name, and the
                      quantity and the actions along the bottom as quiet links.
                      It was an 80px thumbnail, the price floating mid-row, and
                      a second ruled row of three outlined buttons — the
                      heaviest thing on the line was the least-used.
                    */
                    <div key={item.id} className="rounded-xl border border-border bg-card p-3 sm:p-4">
                      <div className="flex gap-3 sm:gap-4">
                        <Link
                          href={routes.store.cake(item.productSlug)}
                          className="size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-cream-100 sm:size-32"
                        >
                          {item.image ? (
                            // At the box's size: a raw <img> fetched the
                            // 600px product photo for a thumbnail.
                            <OptimizedImage
                              src={item.image}
                              alt={item.name}
                              width={128}
                              height={128}
                              sizes="128px"
                              className="size-full object-cover"
                            />
                          ) : null}
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={routes.store.cake(item.productSlug)}
                                className="line-clamp-2 font-medium hover:text-bakery-700 sm:text-base"
                              >
                                {item.name}
                              </Link>
                              {/* The reference's "Estimated Delivery: Today", per line. */}
                              <p className="text-xs text-muted-foreground">
                                <EarliestDelivery />
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-semibold sm:text-lg">
                                {formatCurrency(item.price * item.quantity)}
                              </p>
                              {/*
                                The shop's own compare-at, stamped on the line
                                when it was added — the cart holds lines rather
                                than products, and the catalogue it is handed
                                carries a price already shifted by every default
                                option, so recomputing here would strike a
                                different number from the one the customer saw.
                              */}
                              {item.compareAtPrice && item.compareAtPrice > item.price ? (
                                <p className="text-xs text-muted-foreground">
                                  <span className="line-through">
                                    {formatCurrency(item.compareAtPrice * item.quantity)}
                                  </span>{" "}
                                  <span className="font-medium text-green-700">
                                    ({Math.round((1 - item.price / item.compareAtPrice) * 100)}% off)
                                  </span>
                                </p>
                              ) : null}
                              {item.quantity > 1 ? (
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(item.price)} each
                                </p>
                              ) : null}
                            </div>
                          </div>
                          {/*
                            One list, so this cannot drift from the invoice
                            again — laid out as a grid rather than joined
                            with dots. Four choices on one line wrap into a
                            sentence nobody reads; in columns each is a
                            label and an answer, which is what they are.
                          */}
                          {cartLineChoices(item).length > 0 ? (
                            <dl className="mt-1 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                              {cartLineChoices(item).map((choice) => {
                                // Already "Label: Value" where there is a
                                // label, and a bare stated fact where there
                                // is not — a tick the shop set, which reads
                                // as one thing and must not be split.
                                const at = choice.indexOf(": ");
                                if (at === -1) {
                                  return (
                                    <div key={choice} className="text-muted-foreground">
                                      {choice}
                                    </div>
                                  );
                                }
                                return (
                                  <div key={choice} className="flex gap-2">
                                    <dt className="text-muted-foreground">
                                      {choice.slice(0, at)}
                                    </dt>
                                    <dd className="font-medium">{choice.slice(at + 2)}</dd>
                                  </div>
                                );
                              })}
                            </dl>
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
                              <FrameThumbnail
                                src={item.photoUrl}
                                shape={frameBySlug.get(item.productSlug)}
                                size={40}
                              />
                              Your photo, to be printed on it
                            </span>
                          ) : null}
                          {issuesBySlug.get(item.productSlug) ? (
                            <p className="pt-1 text-xs font-medium text-destructive">
                              {issuesBySlug.get(item.productSlug)?.message}
                            </p>
                          ) : null}
                          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2">
                            <QuantityStepper
                              value={item.quantity}
                              onChange={(value) => updateCartItemQuantity(item.id, value)}
                            />
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              {/*
                                Back to the product page with THIS line's
                                choices already made, and adding again replaces
                                it rather than leaving a near-identical second
                                line behind.
                              */}
                              <Link
                                href={`${routes.store.cake(item.productSlug)}?line=${encodeURIComponent(item.id)}`}
                                className="inline-flex items-center gap-1 py-1 text-sm font-medium text-bakery-700 hover:underline"
                              >
                                <Pencil className="size-3.5" aria-hidden />
                                Edit
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleSaveForLater(item)}
                                className="inline-flex items-center gap-1 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <Bookmark className="size-3.5" aria-hidden />
                                Save for later
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveToWishlist(item)}
                                className="inline-flex items-center gap-1 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <Heart className="size-3.5" aria-hidden />
                                Move to wishlist
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item)}
                                aria-label="Remove item"
                                className="inline-flex items-center gap-1 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/*
                  WHAT THIS BASKET COULD STILL GET, and what it needs.

                  A list of codes on its own is an advertisement. With the
                  subtotal in hand it is an answer — and the shortfall is the
                  part that must be said, or a card sends somebody to a
                  checkout that refuses the code.

                  Nothing renders when the shop has no live coupons, which is
                  every install until an owner switches one on.
                */}
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
                <CartCouponPanel
                  cart={couponLines}
                  applied={coupon}
                  lapsedReason={couponLapsedReason}
                  offers={offers}
                  onApply={applyCoupon}
                  onRemove={() => applyCoupon(undefined)}
                />
                <OrderSummaryPanel
                  items={items}
                  totals={totals}
                  showEditLink={false}
                  showItems={false}
                  discountLabel={validCoupon ? `Coupon (${validCoupon.code})` : undefined}
                  giftWrapLabel={commerce.giftWrapLabel}
                />
                {/*
                  Only from compare-at prices the SHOP typed. Absent otherwise,
                  because a saving computed from anything else is a claim about
                  the past that nobody made — the same rule that had an invented
                  MRP taken out of the repository.
                */}
                {savings + (totals.discount ?? 0) > 0 ? (
                  <p className="text-center text-sm font-semibold text-green-700">
                    You save {formatCurrency(savings + (totals.discount ?? 0))} on this order
                  </p>
                ) : null}
                {/*
                  THE SAME CONTROL, THE SAME SIZE, AS THE THREE STEPS AFTER
                  THIS ONE — 48px and full width, directly under the totals.
                  It was 32px, which is under every touch-target floor and
                  the one place in the purchase where the way on was a
                  different size from everywhere else.

                  AND IT SAYS WHAT IT DOES. Signed out, this opens a dialog
                  headed "Sign in" while the label still reads "Proceed to
                  checkout" — the only hint being a padlock, which the
                  payment step two screens later uses to mean "256-bit SSL".
                  One glyph, two meanings, in one flow. Sign-in before
                  checkout is the shop's decision and stays; the button
                  naming it is the button describing itself, not a claim
                  about the shop. The padlock goes with the ambiguity.
                */}
                <Button
                  className="h-12 w-full text-base"
                  variant="bakery"
                  {...(signedIn
                    ? { render: <Link href={routes.store.checkout} /> }
                    : { onClick: () => openCustomerAuthModal("phone") })}
                >
                  {signedIn ? "Proceed to checkout" : "Sign in to checkout"}
                </Button>
                <Button
                  className="h-11 w-full"
                  variant="outline"
                  render={<Link href={routes.store.collections} />}
                >
                  Continue shopping
                </Button>

                {/*
                  Only what the shop has actually configured.

                  No badge row of unsupported claims — “6000 cities”, “20M
                  happy customers” — which is what this space is usually filled
                  with. The delivery promise is the shop’s own sentence from
                  its commerce settings, and the threshold is the rule its own
                  totals apply. Neither is here when it has not been set.
                */}
                {promise || freeDeliveryOver > 0 ? (
                  // Side by side, icon beside two short lines — the reference's
                  // row under its summary — not a small boxed list.
                  <ul className="grid grid-cols-2 gap-3 px-1 text-xs text-muted-foreground">
                    {promise ? (
                      <li className="flex items-center gap-2">
                        <Truck className="size-6 shrink-0 text-bakery-700" strokeWidth={1.5} />
                        <span className="leading-tight">{promise}</span>
                      </li>
                    ) : null}
                    {freeDeliveryOver > 0 ? (
                      <li className="flex items-center gap-2">
                        <ShieldCheck className="size-6 shrink-0 text-bakery-700" strokeWidth={1.5} />
                        <span className="leading-tight">
                          Free delivery on orders over {formatCurrency(freeDeliveryOver)}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
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
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card p-4 lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{formatCurrency(totals.total)}</p>
              {savings > 0 ? (
                <p className="truncate text-xs font-medium text-bakery-700">
                  You save {formatCurrency(savings + (totals.discount ?? 0))}
                </p>
              ) : null}
            </div>
            {/* The bar and the panel are the same control; they say and
                measure the same thing. */}
            <Button
              className="h-12 flex-1 text-base"
              variant="bakery"
              {...(signedIn
                ? { render: <Link href={routes.store.checkout} /> }
                : { onClick: () => openCustomerAuthModal("phone") })}
            >
              {signedIn ? "Proceed to checkout" : "Sign in to checkout"}
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
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4">
        <h2 className={storefrontHeading.card}>Saved for later</h2>
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
