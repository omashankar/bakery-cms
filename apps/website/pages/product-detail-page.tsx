"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Gift,
  Heart,
  Leaf,
  Share2,
  Tag,
  ShoppingBag,
  ThumbsUp,
  Truck,
} from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import { OptimizedImage } from "@/components/shared/optimized-image";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { PriceDisplay } from "@/components/storefront/price-display";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { StarRating } from "@/components/shared/star-rating";
import { RatingSummary } from "@/components/storefront/rating-summary";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import {
  addToCart,
  getCartItems,
  removeCartItem,
  updateCartItemQuantity,
  type CartLineItem,
} from "@/features/cart/lib/cart";
import { getProductWeightOptions } from "@/features/products/lib/product-catalog";
import { ProductReviewForm } from "@/apps/website/components/product-review-form";
import { ProductQuestionForm } from "@/apps/website/components/product-question-form";
import { fetchProductQuestions } from "@/features/inquiries/lib/inquiries-api";
import type { Inquiry } from "@/types/inquiry";
import { REVIEWS_UPDATED_EVENT } from "@/features/reviews/lib/reviews-repository";
import { markReviewHelpfulRequest } from "@/features/reviews/lib/reviews-api";
import { getHelpfulMarks, rememberHelpfulMark } from "@/features/reviews/lib/helpful-marks";
import {
  getProductGalleryImages,
  getProductReviews,
  getDeliveryTimeSlots,
  getDeliveryPromise,
  getMinDeliveryDate,
  getProductDetailBadges,
  type ProductReview,
} from "@/apps/website/lib/product-details";
import {
  calculateProductUnitPrice,
  formatVariantSummary,
  displayCompareAtPrice,
  weightAxisLabel,
} from "@/features/products/lib/product-pricing";
import {
  asAddOn,
  getDefaultVariantSelections,
  getProductVariantGroups,
  mapLegacyChoice,
  variantGroupsEnabledBy,
} from "@/features/products/lib/variant-utils";
import type { ModuleSettings } from "@/types/settings";
import {
  getModuleSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { isInWishlist, toggleWishlist } from "@/apps/website/lib/wishlist";
import { getRecommendedProducts } from "@/apps/website/lib/recommended-products";
import { recordRecentlyViewedProduct } from "@/apps/website/lib/recently-viewed";
import { ProductRailSection } from "@/apps/website/components/product-rail-section";
import type { LandingProduct } from "@/constants/landing-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency, formatDate, formatRelativeTime } from "@/utils/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { getFreeDeliveryThreshold } from "@/features/orders/lib/cart-totals";
import {
  COUPONS_UPDATED_EVENT,
  getActiveCoupons,
} from "@/features/commerce/lib/coupons-repository";
import { couponDiscountLabel, isLiveCoupon } from "@/features/commerce/lib/coupon-offers";
import { Checkbox } from "@/components/ui/checkbox";
import { DetailSection } from "@/components/storefront/detail-section";
import { OptionButton, OptionGroup } from "@/components/storefront/option-group";

interface ProductDetailPageProps {
  cake: LandingProduct;
  /**
   * The shop’s modules, read on the SERVER.
   *
   * REQUIRED, for the same reason the catalogue props are. This seeded from
   * `defaultModuleSettings` — every module ON — and corrected itself in a
   * client effect from localStorage, so a shop that had switched Flavour or
   * Weight OFF still shipped those pickers in the HTML the browser and the
   * crawler received, and they vanished a beat later. A gate that fails open
   * on the server is not a gate; and an optional prop would let the next
   * caller reintroduce that silently.
   */
  modules: ModuleSettings;
  /**
   * The cart line the customer pressed Edit on, if any.
   *
   * Read from `?line=` on the SERVER and passed down, rather than with
   * `useSearchParams`: that hook forces a Suspense boundary, and everything
   * inside one streams in after the initial HTML — on the one page this shop
   * is found for.
   *
   * Editing is a REPLACE, not an update in place. `cartLineId` folds the size,
   * the options, the message and the photo into a line’s identity precisely so
   * two similar lines stay apart, so changing any of them necessarily makes a
   * different line; adding without removing would leave the customer with two.
   */
  editLineId?: string;
  /**
   * Catalogue data fetched on the server. Passing it in keeps the rendered
   * product rails identical between the server pass and the client, which the
   * old localStorage reads could not do — the server had no localStorage, so it
   * always rendered seed data and then swapped on hydration.
   *
   * REQUIRED, and the client fallbacks that stood behind them are deleted.
   * Both fell through to `getAllProducts()`, which does not go through
   * `toCard` — so a rail built from it carries no `quickAdd`, and every card in
   * it goes back to adding to the cart without recording the size or the
   * options the shop then charges for. The single render site has always passed
   * both, which made the fallbacks unreachable and therefore untested; the same
   * shape as the `cake.category` read that sat dead in `getProductVariantGroups`
   * until a change made it live. A required prop cannot rot that way.
   */
  related: LandingProduct[];
  catalog: LandingProduct[];
}

export function ProductDetailPage({
  cake,
  modules: modulesFromServer,
  editLineId,
  related: relatedFromServer,
  catalog,
}: ProductDetailPageProps) {
  const labels = useBusinessLabels();
  const router = useRouter();
  /**
   * For the RECOMMENDED rail only.
   *
   * Both rails used to merge a localStorage-backed catalogue that the server
   * does not have, so both were gated behind mount. `related` is a server prop
   * now — and leaving the gate on it kept the one rail the crawler could have
   * had out of the initial HTML of the page this shop is found for, on a route
   * whose per-product metadata exists for exactly that reason.
   *
   * `recommended` still ranks by recently-viewed and past orders, which live in
   * this browser and nowhere else. That one genuinely cannot render until it
   * has one.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  /**
   * No mount gate any more, because there is nothing left to gate.
   *
   * `getProductWeightOptions` used to fall back to the localStorage catalog for a
   * product with no tiers of its own, which is why this rendered the shipped seed
   * until mounted. It now reads only the product, so server and client agree by
   * construction — and keeping the gate would have flashed three cake tiers onto
   * a charger for one paint before removing them.
   */
  const weightOptions = useMemo(() => getProductWeightOptions(cake), [cake]);
  const variantGroups = useMemo(() => getProductVariantGroups(cake), [cake]);
  const detailBadges = useMemo(() => getProductDetailBadges(cake), [cake]);
  /** The shop's own facts about this product. Empty when it states none. */
  const attributes = useMemo(() => cake.attributes ?? [], [cake]);
  /** The nutrition tab has something to say only if one of its three fields does. */
  const hasNutrition = Boolean(
    cake.calories || cake.preparationTimeMinutes || cake.shelfLifeDays,
  );
  const galleryImages = useMemo(() => getProductGalleryImages(cake), [cake]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  /**
   * Whether the fetch has answered, however it answered.
   *
   * Without it “Loading reviews…” has no terminal state: a failed fetch, or a
   * stored `reviewCount` that no longer matches its approved reviews, leaves a
   * spinner under a heading claiming a number nothing beneath it supports —
   * permanently. `review.service` records that stale aggregates were measured
   * on this shop, so this is not hypothetical.
   */
  const [reviewsSettled, setReviewsSettled] = useState(false);
  /**
   * The reviews this browser has already marked, and the counts it has seen
   * move since the page loaded.
   *
   * The count is held apart from `reviews` rather than written into it: the
   * list is re-fetched whenever a review is submitted, and merging would mean
   * deciding which of the two numbers is newer on every re-read.
   */
  const [helpfulMarks, setHelpfulMarks] = useState<string[]>([]);
  /** Answered questions only — see `listAnsweredForProduct`. */
  const [questions, setQuestions] = useState<Inquiry[]>([]);
  const [helpfulCounts, setHelpfulCounts] = useState<Record<string, number>>({});
  // The count the SERVER knows, so the heading and the empty state do not
  // contradict the star rating beside them before the fetch lands.
  const reviewCount = reviews.length || cake.reviewCount || 0;
  const [deliverySlots, setDeliverySlots] = useState<string[]>([]);
  const [deliveryPromise, setDeliveryPromise] = useState("");
  const [minDeliveryDate, setMinDeliveryDate] = useState("");
  const [deliveryReady, setDeliveryReady] = useState(false);
  /**
   * What this shop is offering, said where the decision is made.
   *
   * Every one of these already existed and none of them reached the product
   * page. “Free delivery over Rs 999” is a setting the shop has filled in, and
   * the only place a customer was ever told is the CART SUMMARY — after they
   * had chosen. The coupons are live rows a checkout will honour; the homepage
   * advertises them and the page selling the thing did not.
   *
   * Read on the client because both come from local settings, and empty until
   * they do: a shop running no offers gets no block, not an empty heading.
   */
  const [offers, setOffers] = useState<string[]>([]);

  const [selectedWeight, setSelectedWeight] = useState(0);
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>(() =>
    getDefaultVariantSelections(variantGroups)
  );
  const [message, setMessage] = useState("");
  /** The uploaded photo's URL, once the shop has it. Empty until then. */
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);

  /**
   * Seeded from the SERVER, then kept live.
   *
   * The effect stays so an admin toggling a module in another tab sees this
   * page follow — `SETTINGS_UPDATED_EVENT` is dispatched on every settings
   * write and on hydration. What changed is the starting value: it was
   * `defaultModuleSettings`, so the server HTML always claimed every module
   * was on.
   */
  const [modules, setModules] = useState<ModuleSettings>(modulesFromServer);
  useEffect(() => {
    /**
     * NO SYNC AT MOUNT, and that is the whole point of seeding from the server.
     *
     * `getModuleSettings` reads localStorage, and on a cold browser
     * `loadSettings` PERSISTS the shipped defaults — every module ON — and
     * returns them. Calling it on mount therefore threw away the correct
     * server answer on the first visit of every session and put the pickers
     * straight back.
     *
     * The listener alone is right: `SETTINGS_UPDATED_EVENT` fires when the
     * root providers finish hydrating the real settings, and again on every
     * admin write — so the page catches up exactly when there is something
     * truer than the server value to catch up to.
     */
    const sync = () => setModules(getModuleSettings());
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  /**
   * The groups this shop actually sells.
   *
   * This used to hide only the PICKER — the comment here said so: "the group
   * stays in the data + pricing". So a shop with Egg/Eggless switched off still
   * charged every eggless cake its +80 default and still stamped "Egg
   * preference: Eggless" on the order line, for a choice the customer was never
   * shown. The flavour and shape pickers below were already gated for exactly
   * that reason; these two were the ones left.
   */
  const visibleVariantGroups = useMemo(
    () => variantGroupsEnabledBy(variantGroups, modules),
    [variantGroups, modules]
  );

  /** Only what the customer could see, and only what the shop will charge for. */
  const visibleSelections = useMemo(() => {
    const allowed = new Set(visibleVariantGroups.map((group) => group.id));
    return Object.fromEntries(
      Object.entries(variantSelections).filter(([groupId]) => allowed.has(groupId))
    );
  }, [visibleVariantGroups, variantSelections]);

  const weight = weightOptions[selectedWeight] ?? weightOptions[0];
  /**
   * The shop's own word for the axis, not the literal “Weight”.
   *
   * Every OTHER picker on this page is headed by a name the shop typed —
   * `group.name` — while the first and oldest one was headed by a bakery noun
   * in the markup. A shop selling t-shirts got “Weight: S / M / L”.
   */
  const sizeAxisLabel = weightAxisLabel(cake.weightLabel);
  const weightPrice =
    cake.weights?.[selectedWeight]?.price ?? cake.price + (weight?.modifier ?? 0);
  const displayPrice = useMemo(
    () =>
      calculateProductUnitPrice({
        basePrice: cake.price,
        weightPrice,
        variantGroups: visibleVariantGroups,
        variantSelections: visibleSelections,
      }),
    [cake.price, weightPrice, visibleVariantGroups, visibleSelections]
  );
  /**
   * Struck through, and moved by whatever moved the price beside it.
   *
   * `cake.compareAtPrice` is one product-level number while `displayPrice`
   * changes with the size and every option, so the badge used to disappear at
   * the larger sizes — silently, at exactly the sizes a shop most wants to
   * sell.
   */
  const displayCompareAt = useMemo(
    () => displayCompareAtPrice(cake.price, cake.compareAtPrice, displayPrice),
    [cake.price, cake.compareAtPrice, displayPrice],
  );
  const variantSummary = useMemo(
    () => formatVariantSummary(visibleVariantGroups, visibleSelections),
    [visibleVariantGroups, visibleSelections]
  );
  const eggGroup = variantGroups.find((group) => group.type === "egg");
  const selectedEggOption = eggGroup?.options.find(
    (option) => option.id === variantSelections[eggGroup.id]
  );
  const photoGroup = variantGroups.find((group) => group.type === "photo");
  const selectedPhotoOption = photoGroup?.options.find(
    (option) => option.id === variantSelections[photoGroup.id]
  );
  // Branch on the option's semantic, never its label — labels are merchant-editable
  // display text and may be reworded or translated.
  /**
   * NO CATEGORY STRING-MATCHING.
   *
   * These read `category.toLowerCase().includes("eggless")` and
   * `.includes("photo")` — so what a shop had NAMED a category decided what
   * the page claimed about the product and which controls it offered. A
   * category called “Photo Frames” got a photo-cake uploader; one called
   * “Eggless Sponges” had every product in it described as made without eggs,
   * whatever the product said. That is business-type control by another name,
   * decided by a word the shop typed for its own filing.
   *
   * What is left is what the PRODUCT states: the option the customer picked
   * (by `semantic`, never by label — labels are merchant-editable display
   * text), or the product’s own flag.
   */
  const isEggless = selectedEggOption?.semantic === "eggless" || cake.isEggless === true;
  const showPhotoUpload =
    (cake.allowsPhotoUpload === true || selectedPhotoOption?.semantic === "photo-print") &&
    modules.photoCake;
  const isOutOfStock = cake.inStock === false;

  useEffect(() => {
    const slots = getDeliveryTimeSlots();
    const minDate = getMinDeliveryDate();
    setDeliveryPromise(getDeliveryPromise());
    setDeliverySlots(slots);
    setMinDeliveryDate(minDate);
    setDeliveryDate(minDate);
    setDeliveryTime(slots[3] ?? slots[0] ?? "");
    setDeliveryReady(true);
  }, []);

  /**
   * The offers, RE-READ when the caches they come from land.
   *
   * Both the free-delivery threshold and the coupon list are read from
   * localStorage, which the root providers hydrate asynchronously — so an
   * effect with `[]` deps that runs once on mount states whatever the SHIPPED
   * DEFAULT is on the first page view of a session and never corrects itself.
   * A first-time visitor was told “over ₹999” whatever the shop had set.
   */
  useEffect(() => {
    const sync = () => {
      const threshold = getFreeDeliveryThreshold();
      setOffers(
        [
          threshold > 0
            ? `Free delivery on orders over ${formatCurrency(threshold)}`
            : null,
          // `getActiveCoupons` already drops the inactive and the expired, and
          // `isLiveCoupon` is applied on top because it is the predicate the
          // HOMEPAGE row uses — so the two surfaces cannot come to disagree
          // about what is on offer.
          ...getActiveCoupons()
            .filter((coupon) => isLiveCoupon(coupon))
            .map((coupon) => {
              const label = `Use code ${coupon.code} — ${couponDiscountLabel(coupon)}`;
              /**
               * The minimum, SAID OUT LOUD.
               *
               * `isLiveCoupon` deliberately excludes `minSubtotal` — an offer
               * with a minimum is a real offer and the customer can qualify by
               * adding to the basket — and `coupon-offers` says in as many
               * words that it must therefore be SHOWN, or a card sends someone
               * to a checkout that refuses the code. This block dropped it.
               */
              return coupon.minSubtotal
                ? `${label} on orders over ${formatCurrency(coupon.minSubtotal)}`
                : label;
            }),
        ].filter((line): line is string => Boolean(line)),
      );
    };

    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    window.addEventListener(COUPONS_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
      window.removeEventListener(COUPONS_UPDATED_EVENT, sync);
    };
  }, []);

  /**
   * The line being edited, read from the cart in the browser.
   *
   * The cart lives in localStorage, so only the client can answer this. The
   * id alone travels in the URL — putting the choices there instead would
   * mean a link that can assert a size or an option the shop does not sell.
   */
  const [editingLine, setEditingLine] = useState<CartLineItem | null>(null);

  useEffect(() => {
    setWishlisted(isInWishlist(cake.slug));
    setHelpfulMarks(getHelpfulMarks());
    /*
      Fetched, not server-rendered: this is one more round trip on a page
      whose first paint matters, and a question nobody has answered yet is
      the common case — there is usually nothing here to render at all.
    */
    void fetchProductQuestions(cake.slug).then((answered) => {
      if (answered) setQuestions(answered);
    });

    const line = editLineId
      ? getCartItems().find(
          (item) => item.id === editLineId && item.productSlug === cake.slug,
        )
      : undefined;
    setEditingLine(line ?? null);

    if (!line) {
      setVariantSelections(getDefaultVariantSelections(getProductVariantGroups(cake)));
      setSelectedWeight(0);
      return;
    }

    /**
     * The stored choices OVER the defaults, never instead of them: a group the
     * shop has added since this line was made has no answer on the line, and
     * an unanswered group is priced at its default anyway — so leaving it out
     * would show the customer one thing and charge them for another.
     */
    const groups = getProductVariantGroups(cake);
    /**
     * What the LINE actually says, before any default is laid under it.
     *
     * `mapLegacyChoice` refuses to map when the group already has an answer —
     * a real selection must always beat a legacy field — so merging the
     * defaults in first would make every group already-answered and the
     * mapping below a no-op. This is the same order the server uses.
     */
    const carried: Record<string, string> = { ...(line.variantSelections ?? {}) };
    /**
     * A line from before shapes and flavours became variant groups carries the
     * old flat field and no selection for it. `priceLine` maps those onto the
     * matching option and charges accordingly; without the same mapping here,
     * pressing Edit on such a line showed the group's DEFAULT — so a customer
     * opening their Heart cake to change the message saw Round, and committing
     * quietly swapped what the kitchen would bake.
     *
     * Unmatched values are left alone, exactly as the server leaves them: a
     * shape the shop has since renamed is the customer's own word, and the line
     * keeps carrying it.
     */
    for (const [group, legacy] of [
      [groups.find((candidate) => candidate.type === "shape"), line.shape],
      [
        groups.find((candidate) => candidate.name.trim().toLowerCase() === "flavour"),
        line.flavour,
      ],
    ] as const) {
      const mapped = mapLegacyChoice(group, legacy, carried);
      if (mapped) carried[mapped.groupId] = mapped.optionId;
    }
    // Defaults UNDER the line's own answers: a group the shop has added since
    // this line was made has no answer on it, and an unanswered group is
    // priced at its default anyway — so leaving it out would show the customer
    // one thing and charge them for another.
    setVariantSelections({ ...getDefaultVariantSelections(groups), ...carried });
    const tier = getProductWeightOptions(cake).findIndex(
      (option) => option.label === line.weight,
    );
    setSelectedWeight(tier >= 0 ? tier : 0);
    setQuantity(line.quantity);
    setMessage(line.message ?? "");
    setPhotoUrl(line.photoUrl ?? "");
    /*
      NOT the delivery date. A line made last week may name a day that has
      passed, and restoring it would let a customer place an order for it. The
      picker is already defaulted to the earliest date the shop can actually
      manage, which is the honest answer to a question being asked again.
    */
  }, [cake, editLineId]);

  // Same-category first, then top up from the wider catalogue so this row always
  // shows a full set of 4 — never a lone card floating in an empty grid.
  const related = relatedFromServer;
  // Recommendations rank by recently-viewed and past orders, which live in this
  // browser — so this stays client-side even though the catalogue comes from
  // the server.
  const recommended = useMemo(
    () =>
      getRecommendedProducts({
        limit: 4,
        excludeSlugs: [cake.slug, ...related.map((item) => item.slug)],
        catalog,
      }),
    [cake.slug, related, catalog]
  );

  useEffect(() => {
    recordRecentlyViewedProduct(cake.slug);
  }, [cake.slug]);

  useEffect(() => {
    // The list now comes from the server, so this is async and can land after
    // the visitor has navigated on. `cancelled` keeps one product's reviews from
    // arriving under another product's page.
    let cancelled = false;

    async function refreshReviews() {
      const fetched = await getProductReviews(cake);
      if (cancelled) return;
      // Null is a failed read, not an empty list — leave what is on screen.
      if (fetched) setReviews(fetched);
      // Settled either way. A FAILED read still ends the loading state, or the
      // spinner outlives the request that started it.
      setReviewsSettled(true);
    }

    void refreshReviews();
    window.addEventListener(REVIEWS_UPDATED_EVENT, refreshReviews);
    return () => {
      cancelled = true;
      window.removeEventListener(REVIEWS_UPDATED_EVENT, refreshReviews);
    };
  }, [cake]);

  /**
   * Send the photo to the shop, and only then say it is attached.
   *
   * The old control reported "Selected: birthday.jpg" the instant the file
   * was chosen, which was true about the browser and false about everything
   * else. Nothing is claimed here until the server answers with a URL.
   */
  async function handlePhotoUpload(file: File) {
    /**
     * No sign-in gate. This asked for a phone number and an OTP the moment
     * somebody pressed Upload — before they had bought anything, on the one
     * control that makes a photo cake a photo cake. Checkout still requires an
     * account; deciding does not. The endpoint carries its own limits.
     */
    setPhotoUploading(true);
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await fetch("/api/uploads/photo-cake", {
        method: "POST",
        credentials: "same-origin",
        body,
      });
      const parsed = (await res.json().catch(() => null)) as
        | { data?: { url?: string }; message?: string }
        | null;

      if (!res.ok || !parsed?.data?.url) {
        setPhotoUrl("");
        toast.error(parsed?.message ?? "Could not upload that photo");
        return;
      }

      setPhotoUrl(parsed.data.url);
      toast.success("Photo attached");
    } catch {
      setPhotoUrl("");
      toast.error("Could not reach the shop", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setPhotoUploading(false);
    }
  }

  const handleAddToCart = (redirectToCart = false) => {
    if (isOutOfStock) {
      toast.error(`This ${labels.productWord.toLowerCase()} is currently out of stock`);
      return;
    }

    const line = addToCart({
      productSlug: cake.slug,
      name: cake.name,
      image: cake.image,
      price: displayPrice,
      quantity,
      // Gated like the two below it. The weight picker is hidden when the
      // module is off, but `weight` still defaulted to the first tier — so a
      // shop with Weight switched off recorded "0.5 kg" on every cart line,
      // order, invoice and confirmation email, for a size no customer was ever
      // shown and no baker agreed to.
      weight: (modules.weight && weight?.label) || undefined,
      // Carried onto the line so the cart, the invoice and the kitchen email
      // head the value with the same word this page did. Absent when the shop
      // has not named the axis — those surfaces fall back the same way.
      weightLabel: (modules.weight && weight?.label && cake.weightLabel?.trim()) || undefined,
      // The struck-through price the customer was actually shown, for THIS
      // configuration. The cart holds lines rather than products and cannot
      // work it out again — and undefined here is the honest answer for a shop
      // that has not claimed a higher price.
      compareAtPrice: displayCompareAt,
      // No `flavour` on the line any more, for the same reason `shape` went:
      // it is a variant group, so the choice travels in `variantSummary` with
      // every other option. The field stays on the type because ORDERS ALREADY
      // PLACED carry it.
      // No `shape` on the line any more. A shape is a variant group, so the
      // choice travels in `variantSummary` as “Shape: Heart” with every other
      // option — one place, which is what `cartLineChoices` was written for.
      // The field stays on the type because ORDERS ALREADY PLACED carry it.
      message: message.trim() || undefined,
      photoUrl: photoUrl || undefined,
      deliveryDate,
      deliveryTime,
      // Only the groups the customer could see. `calculateVariantAdjustment`
      // falls back to a group's default option when no selection is sent, so
      // the server-side gate in pricing.server.ts is what actually stops the
      // charge; this stops the ORDER recording a choice nobody made.
      variantSelections: visibleSelections,
      variantSummary,
    });

    /**
     * The line this edit came from — removed only when the replacement is a
     * DIFFERENT line.
     *
     * This removed it unconditionally, and that emptied the cart for the
     * commonest edit there is. `cartLineId` keys on the size, the options, the
     * message and the photo; it does NOT key on quantity or the delivery date.
     * So a customer who pressed Edit and changed only the quantity — or
     * changed nothing and pressed the button — produced the SAME id, `addToCart`
     * merged into the very line being edited (doubling its quantity), and this
     * line then deleted it. The item vanished under a “Cart updated” toast.
     *
     * `addToCart` returns the resulting line, which is the only thing that
     * knows which of the two happened.
     */
    if (editingLine) {
      if (line.id === editingLine.id) {
        // Merged into itself: the merge branch ADDED to the quantity that was
        // already there, so the edited value has to be set, not accumulated.
        updateCartItemQuantity(line.id, quantity);
      } else {
        removeCartItem(editingLine.id);
      }
    }

    toast.success(editingLine ? "Cart updated" : "Added to cart", {
      description: `${quantity} × ${cake.name}`,
    });

    // An edit came FROM the cart, so it goes back there — the customer asked
    // to change a line, not to carry on shopping.
    if (redirectToCart || editingLine) {
      router.push(routes.store.cart);
    }
  };

  /**
   * Counted optimistically, then corrected by the server's own number.
   *
   * The mark is remembered whatever the request does. A reader who pressed it
   * and got a network error has still said what they think, and offering the
   * button again would invite them to say it twice.
   */
  const handleHelpful = async (review: ProductReview) => {
    /**
     * Read from the STORE, not from state.
     *
     * `helpfulMarks` is a render closure, so two clicks landing before React
     * re-renders both see the empty array it was rendered with — and the
     * disabled attribute, which is the other half of this, has not been
     * applied yet either. `rememberHelpfulMark` writes synchronously, so the
     * store is the only thing that already knows about the first press.
     */
    if (getHelpfulMarks().includes(review.id)) return;
    rememberHelpfulMark(review.id);
    setHelpfulMarks((current) => [...current, review.id]);
    setHelpfulCounts((current) => ({
      ...current,
      [review.id]: (current[review.id] ?? review.helpfulCount ?? 0) + 1,
    }));

    const settled = await markReviewHelpfulRequest(review.id);
    if (settled !== null) {
      setHelpfulCounts((current) => ({ ...current, [review.id]: settled }));
    }
  };

  const handleWishlist = () => {
    const added = toggleWishlist(cake.slug);
    setWishlisted(added);
    toast.success(added ? "Added to wishlist" : "Removed from wishlist");
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: cake.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not share link");
    }
  };

  return (
    <>
      <StorePageHeader
        title={cake.name}
        breadcrumbs={[
          { label: "Collections", href: routes.store.collections },
          { label: cake.name },
        ]}
        className="[&_h1]:sr-only"
      />

      <section className={cn(layoutSpacing.sectionY, "pb-24 lg:pb-16")}>
        <div className={layoutSpacing.container}>
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            {/*
              The photo stays put while the right column scrolls.
              With everything below the fold now stacked rather than tabbed,
              this column is long — and the image used to leave the screen a
              third of the way down, so a customer reading the ingredients could
              no longer see what they were reading about.
            */}
            <div className="lg:sticky lg:top-24">
              <ProductGallery images={galleryImages} productName={cake.name} />
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {cake.category ? <Badge variant="accent">{cake.category}</Badge> : null}
                  {modules.eggEggless && isEggless ? (
                    <span className="contents" data-gate-egg>
                      <Badge variant="outline" className="gap-1">
                        <Leaf className="size-3" />
                        Eggless
                      </Badge>
                    </span>
                  ) : null}
                  {cake.badge ? <Badge variant="gold">{cake.badge}</Badge> : null}
                </div>
                <h2 className="font-heading text-3xl font-bold sm:text-4xl">{cake.name}</h2>
                {cake.rating ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <StarRating rating={cake.rating} size="md" showValue />
                    {reviews.length ? <span>({reviews.length} reviews)</span> : null}
                  </div>
                ) : null}
                <p className="text-muted-foreground">{cake.description}</p>
                {detailBadges.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {detailBadges.map((badge) => (
                      <Badge key={badge} variant="outline">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-border bg-cream-50 p-4">
                <PriceDisplay price={displayPrice} compareAtPrice={displayCompareAt} />
                {/*
                  Only when this product IS sold by size.
                  `weight?.serves ?? "8–10"` and `weight?.label ?? "1 kg"` were
                  unreachable while `getProductWeightOptions` could not return an
                  empty list. It can now, deliberately — so a phone charger stated,
                  under its price and gated by nothing, that it serves 8–10 people
                  and weighs 1 kg. A fallback is not a fact.

                  `serves` stays optional within that: a tier can be priced without
                  claiming a headcount.
                */}
                {weight ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {weight.serves ? `Serves ${weight.serves} people · ` : ""}
                    {weight.label}
                  </p>
                ) : null}
                {variantSummary.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">{variantSummary.join(" · ")}</p>
                ) : null}
              </div>

              {/* Only offered when this cake actually comes in several flavours. */}
              {/*
                The hard-coded Flavour picker stood here, two lines above a loop
                that already renders every group by its OWN name. Two option
                systems on one screen, and only one of them could carry a price
                or be named by the shop — so a flavour could never cost more, and
                a shop selling colours or storage sizes had nowhere to put them.

                `flavourOptions` is migrated into a variant group, exactly as
                `shapes` was. Nothing is lost: it was an unpriced list of names.
              */}

              {modules.weight ? (
                <div className="contents" data-gate-weight>
                  <OptionGroup label={sizeAxisLabel} count={weightOptions.length}>
                    <div className="flex flex-wrap gap-2">
                      {weightOptions.map((option, index) => (
                        <OptionButton
                          key={option.label}
                          active={selectedWeight === index}
                          onClick={() => setSelectedWeight(index)}
                        >
                          {option.label}
                        </OptionButton>
                      ))}
                    </div>
                  </OptionGroup>
                </div>
              ) : null}

              {/*
                An ADD-ON reads as a tick, a CHOICE reads as buttons.

                Every group rendered as a labelled row of buttons, so “Eggless”
                arrived as a heading over [With egg] [Eggless (+₹80)] — two
                buttons and a title to say one yes-or-no thing. A group with two
                options whose default costs nothing IS a yes-or-no thing, and
                the reference storefront shows exactly that: a small tick
                reading “Eggless”, another reading “Heart Shape”, side by side.

                The rule follows the DATA rather than the group’s name, so a
                shop gets the compact form by describing an add-on and the
                buttons by describing a real choice. Round / Square / Heart is
                three-way and stays buttons; Round / Heart at +₹150 becomes a
                tick.
              */}
              {visibleVariantGroups.map((group) => {
                const gates = {
                  "data-gate-egg": group.type === "egg" ? "" : undefined,
                  "data-gate-photo": group.type === "photo" ? "" : undefined,
                  "data-gate-shape": group.type === "shape" ? "" : undefined,
                };
                const addOn = asAddOn(group);

                if (addOn) {
                  const on = variantSelections[group.id] === addOn.on.id;
                  return (
                    <label
                      key={group.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                      {...gates}
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={(checked) =>
                          setVariantSelections((current) => {
                            if (checked === true) {
                              return { ...current, [group.id]: addOn.on.id };
                            }
                            /*
                              Unticking an add-on with no off-state REMOVES the
                              answer rather than choosing another one — there is
                              no other option to choose, and an empty string
                              would be an id that matches nothing while still
                              looking like an answer.
                            */
                            if (!addOn.off) {
                              const { [group.id]: _dropped, ...rest } = current;
                              return rest;
                            }
                            return { ...current, [group.id]: addOn.off.id };
                          })
                        }
                      />
                      {/*
                        THE LABEL, and only the label.

                        The surcharge used to be printed beside it. It reads as
                        a price tag on the words — “Eggless +₹80” — next to a
                        box whose own name is the thing being offered, and on an
                        add-on that costs nothing it printed “+₹0”, which is an
                        announcement about nothing.

                        The number has not gone anywhere: the price block sits
                        directly above these boxes and moves the moment one is
                        ticked. That is where a total belongs, and it is the one
                        that stays right when several are ticked at once — three
                        labels each carrying their own “+₹” never add up to the
                        figure the customer will actually pay.
                      */}
                      <span>{addOn.on.label}</span>
                    </label>
                  );
                }

                return (
                  <div key={group.id} className="contents" {...gates}>
                    <OptionGroup label={group.name} count={group.options.length}>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((option) => (
                          <OptionButton
                            key={option.id}
                            active={variantSelections[group.id] === option.id}
                            onClick={() =>
                              setVariantSelections((current) => ({
                                ...current,
                                [group.id]: option.id,
                              }))
                            }
                          >
                            {option.label}
                            {option.priceAdjustment !== 0
                              ? ` (${option.priceAdjustment > 0 ? "+" : ""}${formatCurrency(option.priceAdjustment)})`
                              : ""}
                          </OptionButton>
                        ))}
                      </div>
                    </OptionGroup>
                  </div>
                );
              })}

              {/*
                The shape picker that stood here is gone. Shapes are a typed
                VARIANT GROUP now, rendered by the loop above like egg
                preference and photo cake — so each one can carry a price, a
                shop can name its own rather than choosing from four hardcoded
                ones, and there is one option system instead of two.
              */}

              {cake.allowsMessage !== false ? (
                <div className="space-y-2">
                  <Label htmlFor="product-message">Message on this order</Label>
                  <Textarea
                    id="product-message"
                    placeholder='e.g. "Happy Birthday!"'
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={3}
                  />
                </div>
              ) : null}

              {/*
                The photo a photo cake is printed with.

                This kept the file NAME in local state and nothing else — never
                uploaded, never on the cart line, never on the order. The bakery
                received an order for a photo cake with no photo and no sign one
                had been chosen, after the customer had watched themselves
                attach it and paid the photo surcharge.

                It now uploads to `/api/uploads/photo-cake`, which takes NO
                sign-in — asking for a phone number before somebody has bought
                anything is where people leave, and checkout still asks. It
                checks the magic bytes rather than the browser’s word for the
                type, caps the size, refuses cross-site posts, budgets what it
                accepts, and deletes any photo no order or draft claims.

                This comment said “requires a signed-in customer” for a commit
                after that stopped being true — directly above the control it
                describes.
              */}
              {showPhotoUpload ? (
                <div className="space-y-2" data-gate-photo>
                  <Label htmlFor="photo-upload">Upload your photo</Label>
                  <Input
                    id="photo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={photoUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      // The input is cleared either way, so choosing the same
                      // file again after a failure still fires a change.
                      event.target.value = "";
                      if (file) void handlePhotoUpload(file);
                    }}
                  />
                  {photoUploading ? (
                    <p className="text-xs text-muted-foreground">Uploading your photo…</p>
                  ) : photoUrl ? (
                    <p className="flex items-center gap-1.5 text-xs text-green-700">
                      <Check className="size-3.5" />
                      Photo attached — it will reach the shop with your order.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      JPEG, PNG or WebP, up to 6 MB.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="delivery-date">Delivery date</Label>
                  <Input
                    id="delivery-date"
                    type="date"
                    min={minDeliveryDate}
                    value={deliveryDate}
                    onChange={(event) => setDeliveryDate(event.target.value)}
                    disabled={!deliveryReady}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery-time">Delivery time</Label>
                  <select
                    id="delivery-time"
                    value={deliveryTime}
                    onChange={(event) => setDeliveryTime(event.target.value)}
                    disabled={!deliveryReady}
                    className="flex h-8 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  >
                    {deliverySlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Quantity</p>
                  <QuantityStepper value={quantity} onChange={setQuantity} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleWishlist}>
                    <Heart className={cn("size-4", wishlisted && "fill-bakery-700 text-bakery-700")} />
                    Wishlist
                  </Button>
                  <Button type="button" variant="outline" onClick={handleShare}>
                    <Share2 className="size-4" />
                    Share
                  </Button>
                </div>
              </div>

              {/*
                ONE button, where there were two.

                "Buy Now" added the same line as "Add to Cart" and then pushed
                to the cart — the same action, differently worded, sitting
                beside it in the loudest place on the page. Two primary CTAs
                make a customer choose between them before they can do the one
                thing they came to do, and the difference between the pair was
                a navigation they can make for themselves; the header cart
                count and the toast both already point the way.
              */}
              <div className="hidden flex-wrap gap-3 lg:flex">
                <Button
                  size="lg"
                  variant="bakery"
                  className="flex-1"
                  disabled={isOutOfStock}
                  onClick={() => handleAddToCart(false)}
                >
                  <ShoppingBag className="size-4" />
                  {isOutOfStock ? "Out of stock" : editingLine ? "Update cart" : "Add to Cart"}
                </Button>
              </div>

              {offers.length > 0 ? (
                <div className="rounded-xl border border-dashed border-bakery-300 bg-white p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-bakery-700">
                    <Tag className="size-4" />
                    Available offers
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {offers.map((offer) => (
                      <li key={offer} className="flex gap-2">
                        <span aria-hidden className="text-bakery-700">•</span>
                        <span>{offer}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/*
                WHAT THE SHOP CAN ACTUALLY SAY, and only that.

                Two rows sat here and both were broken. The delivery promise is
                filled by a client effect from `""`, so the server HTML shipped
                an icon with nothing beside it. And “Eggless available” was
                gated on the egg MODULE rather than on whether this product is
                eggless — so it printed under every product in the shop, a
                fallback presented as a fact, in the exact lines that are
                supposed to be the reason to trust the page.

                “Freshly baked” was removed from here earlier for the same
                reason. Each row now waits for something true to say.
              */}
              <ul className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                {deliveryPromise ? (
                  <li className="flex items-start gap-2 rounded-xl border border-border bg-cream-50 p-3">
                    <Truck className="mt-0.5 size-4 shrink-0 text-bakery-700" />
                    <span>{deliveryPromise}</span>
                  </li>
                ) : null}
                {modules.eggEggless && isEggless ? (
                  <li
                    className="flex items-start gap-2 rounded-xl border border-border bg-cream-50 p-3"
                    data-gate-egg
                  >
                    <Leaf className="mt-0.5 size-4 shrink-0 text-bakery-700" />
                    <span>Made without eggs</span>
                  </li>
                ) : null}
                {cake.allowsMessage !== false ? (
                  <li className="flex items-start gap-2 rounded-xl border border-border bg-cream-50 p-3">
                    <Gift className="mt-0.5 size-4 shrink-0 text-bakery-700" />
                    <span>Free message card</span>
                  </li>
                ) : null}
              </ul>

              {/*
                STACKED, NOT TABBED.

                These were six tabs, and Base UI unmounts the panel that is not
                showing — so five sixths of everything the shop had written about
                its product was absent from the HTML the browser received, absent
                from what Google indexed, and on a phone sat behind a tab strip
                that scrolls sideways. The shop typed ingredients, allergens and
                care instructions into the admin and almost nobody ever saw them.

                Every section still gates itself on the product carrying the
                field, which is what tabs were really buying: a phone charger
                shows no Ingredients heading at all rather than an empty one.
              */}
              <div className="space-y-6">
                {attributes.length > 0 ? (
                  <DetailSection title={`${labels.productWord} details`}>
                    {/* The shop's own facts, as a spec list. */}
                    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                      {attributes.map((attribute) => (
                        <div
                          key={attribute.id}
                          className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-2"
                        >
                          <dt className="text-muted-foreground">{attribute.label}</dt>
                          <dd className="font-medium text-foreground">{attribute.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </DetailSection>
                ) : null}

                {cake.ingredients ? (
                  <DetailSection title="Ingredients">
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {cake.ingredients}
                      {modules.eggEggless && isEggless
                        ? ` This ${labels.productWord.toLowerCase()} is prepared without eggs.`
                        : ""}
                    </p>
                  </DetailSection>
                ) : null}

                {hasNutrition ? (
                  <DetailSection title="Nutrition">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {cake.calories ? (
                        <p>
                          <span className="font-medium text-foreground">Calories:</span>{" "}
                          {cake.calories} kcal per serving
                        </p>
                      ) : null}
                      {cake.preparationTimeMinutes ? (
                        <p>
                          <span className="font-medium text-foreground">Preparation:</span>{" "}
                          {detailBadges.find((badge) => badge.includes("prep")) ??
                            `${cake.preparationTimeMinutes} minutes`}
                        </p>
                      ) : null}
                      {cake.shelfLifeDays ? (
                        <p>
                          <span className="font-medium text-foreground">Shelf life:</span>{" "}
                          {cake.shelfLifeDays} day{cake.shelfLifeDays === 1 ? "" : "s"} when stored
                          properly
                        </p>
                      ) : null}
                    </div>
                  </DetailSection>
                ) : null}

                {cake.allergens ? (
                  <DetailSection title="Allergens">
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {cake.allergens}
                    </p>
                  </DetailSection>
                ) : null}

                {cake.careInstructions ? (
                  <DetailSection title="Care instructions">
                    {/*
                      `whitespace-pre-line`, because a shop writes care notes as
                      a list. Without it every line break collapsed and four
                      instructions arrived as one run-on sentence.
                    */}
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {cake.careInstructions}
                    </p>
                  </DetailSection>
                ) : null}

                <DetailSection title="Delivery">
                  <p className="text-sm text-muted-foreground">
                    {/*
                      "within city limits" went with the rest of the invented
                      delivery-area copy: there is no field behind it, and a shop
                      that delivers to four localities was making a claim about a
                      whole city.
                    */}
                    {/*
                      Guarded, like the trust-strip row above. `deliveryPromise`
                      starts “” and is filled by a client effect, so the crawled
                      HTML read “. Scheduled delivery on your selected date.” —
                      a sentence beginning with a full stop. Under tabs this
                      panel was unmounted and never shipped at all.
                    */}
                    {deliveryPromise ? `${deliveryPromise}. ` : ""}
                    Scheduled delivery on{" "}
                    {deliveryDate ? formatDate(deliveryDate) : "your selected date"}
                    {deliveryTime ? ` between ${deliveryTime}` : ""}.
                    {/*
                      Only promised where the product actually takes a message.
                      This was unconditional, so a shop selling chargers offered
                      every customer a free message card it had no way to send.
                    */}
                    {cake.allowsMessage !== false
                      ? " Custom message card included at no extra charge."
                      : ""}
                  </p>
                </DetailSection>

                {/*
                  `id`, so the star rating beside the title has somewhere to jump
                  to — and so the review-request email can link straight here.
                */}
                {/*
                  Questions and answers, on the enquiry system this shop
                  already runs. Only ANSWERED ones are here: an unanswered
                  question is a stranger’s message in the shop’s inbox, and
                  publishing it unread would put their words on the shop’s
                  page under the shop’s name.

                  The list hides itself when there is nothing in it; the form
                  does not, because being able to ask is the point and a shop
                  with no questions yet is the normal case.
                */}
                <DetailSection id="questions" title="Questions">
                  <div className="space-y-4">
                    {questions.length > 0 ? (
                      <div className="space-y-3">
                        {questions.map((question) => (
                          <article
                            key={question.id}
                            className="rounded-xl border border-border bg-white p-4"
                          >
                            <p className="text-sm font-medium">Q: {question.message}</p>
                            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                              A: {question.answer}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Asked by {question.name}
                              {question.answeredAt
                                ? ` · answered ${formatRelativeTime(question.answeredAt)}`
                                : ""}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    <ProductQuestionForm
                      productSlug={cake.slug}
                      productName={cake.name}
                    />
                  </div>
                </DetailSection>

                <DetailSection
                  id="reviews"
                  title={`Reviews${reviewCount ? ` (${reviewCount})` : ""}`}
                >
                  <div className="space-y-4">
                    {/*
                      Counted from the rows rendered below it, so the summary
                      and the list cannot disagree. Renders nothing when there
                      is nothing to summarise.
                    */}
                    <RatingSummary reviews={reviews} />
                    <ProductReviewForm
                      productSlug={cake.slug}
                      cakeName={cake.name}
                      onSubmitted={() => {
                        // A new review is pending, so this re-read normally comes
                        // back unchanged — which is the honest outcome. It runs so
                        // that anything approved since the page loaded appears.
                        void getProductReviews(cake).then((next) => {
                          if (next) setReviews(next);
                        });
                      }}
                    />
                    {reviews.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {/*
                          `reviews` is fetched on the CLIENT and starts empty, so
                          this said “no published reviews” in the server HTML of
                          products carrying a 4.8-star rating rendered from the
                          same payload two hundred lines above — a page
                          contradicting itself, to a crawler, on the commit whose
                          whole motive was that tabbed content never reached one.
                          `reviewCount` is on the payload and is server-rendered.
                        */}
                        {reviewCount && !reviewsSettled
                          ? "Loading reviews…"
                          : "No published reviews yet. Be the first to share your experience."}
                      </p>
                    ) : (
                      reviews.map((review) => (
                        <article
                          key={review.id}
                          className="rounded-xl border border-border bg-white p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{review.author}</p>
                              {review.isFeatured ? <Badge variant="gold">Featured</Badge> : null}
                              {/*
                                Shown only where the SERVER could match this
                                reviewer's signed-in account to an order of this
                                product that actually reached Delivered. It is a
                                statement that somebody in that city bought this
                                and received it, so nothing a browser can type
                                may reach it — and for most reviews it is simply
                                absent, which is the honest answer.
                              */}
                              {review.deliveredCity ? (
                                <span className="text-xs text-muted-foreground">
                                  Delivered in {review.deliveredCity}
                                </span>
                              ) : null}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(review.date)}
                            </span>
                          </div>
                          {review.title ? (
                            <p className="mt-1 text-sm font-medium">{review.title}</p>
                          ) : null}
                          <StarRating rating={review.rating} className="mt-2" />
                          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                            {review.text}
                          </p>
                          {/*
                            The reviewer's own photos of what arrived.

                            Only URLs this shop stored itself reach here: the
                            submit endpoint is public, and an off-site image on
                            a product page loads for every visitor and can be
                            swapped for something else after a moderator has
                            approved it.
                          */}
                          {review.photoUrls?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {review.photoUrls.map((url) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="size-20 overflow-hidden rounded-lg border border-border bg-cream-100"
                                >
                                  <OptimizedImage
                                    src={url}
                                    alt=""
                                    width={80}
                                    height={80}
                                    className="size-full object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}
                          {review.adminReply ? (
                            <div className="mt-3 rounded-lg border border-border bg-cream-50 px-3 py-2 text-sm">
                              <p className="font-medium text-bakery-700">Response from the shop</p>
                              <p className="mt-1 whitespace-pre-line text-muted-foreground">
                                {review.adminReply}
                              </p>
                            </div>
                          ) : null}
                          {/*
                            One direction only. There is no way to say a review
                            was UNhelpful: a button that buries what somebody
                            wrote is a moderation tool wearing a reader’s face,
                            and this shop moderates on its own screen.

                            The number is shown only once somebody has pressed
                            it. “Helpful (0)” reads as a verdict on the review.
                          */}
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={helpfulMarks.includes(review.id)}
                              onClick={() => void handleHelpful(review)}
                            >
                              <ThumbsUp className="size-4" />
                              {helpfulMarks.includes(review.id) ? "Marked helpful" : "Helpful"}
                            </Button>
                            {(helpfulCounts[review.id] ?? review.helpfulCount ?? 0) > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {helpfulCounts[review.id] ?? review.helpfulCount}
                                {" "}
                                {(helpfulCounts[review.id] ?? review.helpfulCount) === 1
                                  ? "person"
                                  : "people"}{" "}
                                found this helpful
                              </span>
                            ) : null}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </DetailSection>

                {/*
                  THE ONE STORED FIELD NO STOREFRONT SURFACE SHOWED.

                  The admin has taken a “Barcode / SKU” for as long as the
                  product form has existed and nothing anywhere rendered it —
                  a field an owner fills in and never sees again.

                  Generic Name and Country of Origin are asked for in the same
                  breath and are deliberately NOT new fields: a shop states
                  those through `attributes`, which is the system this project
                  already has for owner-defined facts and which the section
                  above renders. Three more columns would be a parallel one.
                */}
                {cake.barcode ? (
                  <p className="border-t border-border pt-6 text-xs text-muted-foreground">
                    SKU: {cake.barcode}
                  </p>
                ) : null}
              </div>

            </div>
          </div>

          {related.length > 0 ? (
            <div className="mt-16 border-t border-border pt-16">
              <ScrollReveal className="mb-8 flex items-end justify-between gap-4">
                <h2 className="font-heading text-2xl font-bold">You May Also Like</h2>
                <Button variant="ghost" render={<Link href={routes.store.collections} />}>
                  View all
                </Button>
              </ScrollReveal>
              <StaggerReveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((item) => (
                  <ProductCard key={item.id} cake={item} />
                ))}
              </StaggerReveal>
            </div>
          ) : null}

          {mounted && recommended.length > 0 ? (
            <div className="mt-16 border-t border-border pt-16">
              <ProductRailSection
                title="Recommended for you"
                description="Based on your browsing and popular picks."
                cakes={recommended}
              />
            </div>
          ) : null}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white p-4 lg:hidden">
        <div className="mx-auto flex max-w-lg gap-3">
          <Button
            variant="bakery"
            className="flex-1"
            disabled={isOutOfStock}
            onClick={() => handleAddToCart(false)}
          >
            {isOutOfStock ? "Out of stock" : editingLine ? "Update cart" : "Add to Cart"}
          </Button>
        </div>
      </div>
    </>
  );
}
