"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Gift,
  Heart,
  ImageUp,
  Share2,
  Tag,
  ShoppingBag,
  ThumbsUp,
  Truck,
} from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import type { ProductVariantGroup } from "@/types/product";
import { OptimizedImage } from "@/components/shared/optimized-image";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { PhotoPrintEditor } from "@/components/storefront/photo-print-editor";
import {
  emptyPhotoPrintDraft,
  type PhotoPrintDraft,
} from "@/lib/images/photo-print-layout";
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
  timeLeftToday,
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
  formatPreparationTime,
  getProductVariantGroups,
  mapLegacyChoice,
  variantGroupsEnabledBy,
} from "@/features/products/lib/variant-utils";
import type { ModuleSettings } from "@/types/settings";
import {
  getCommerceSettings,
  getModuleSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
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
  /**
   * Everything the shop has stated about this product, as one bulleted list.
   *
   * The shop's own `attributes` first — Brand, Material, Country of Origin,
   * whatever it chose to say — then the three fixed food facts, each of which
   * had a heading of its own and three lines beneath it. Same data, one list.
   */
  const productFacts = useMemo(() => {
    const facts = attributes.map((attribute) => ({
      label: attribute.label,
      value: attribute.value,
    }));

    if (cake.calories) {
      facts.push({ label: "Calories", value: `${cake.calories} kcal per serving` });
    }
    if (cake.preparationTimeMinutes) {
      facts.push({
        label: "Preparation",
        value: formatPreparationTime(cake.preparationTimeMinutes) ?? "",
      });
    }
    if (cake.shelfLifeDays) {
      facts.push({
        label: "Shelf life",
        value: `${cake.shelfLifeDays} day${cake.shelfLifeDays === 1 ? "" : "s"} when stored properly`,
      });
    }

    return facts.filter((fact) => fact.value.trim().length > 0);
  }, [attributes, cake.calories, cake.preparationTimeMinutes, cake.shelfLifeDays]);

  /**
   * One line typed is one bullet.
   *
   * A shop writes care notes as a list and they arrived as one run-on
   * paragraph held together by `whitespace-pre-line`. Splitting needs no new
   * field and no new habit: what the shop already types is already a list.
   */
  const careNotes = (cake.careInstructions ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
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
  /**
   * The shop's commerce settings, for the one line under the price.
   *
   * Seeded with the shipped defaults so the server pass and the first client
   * paint agree, then refreshed by the same `sync` the offers use.
   */
  const [commerce, setCommerce] = useState(defaultCommerceSettings);
  const [offers, setOffers] = useState<string[]>([]);

  const [selectedWeight, setSelectedWeight] = useState(0);
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>(() =>
    getDefaultVariantSelections(variantGroups)
  );
  const [message, setMessage] = useState("");
  /** The uploaded photo's URL, once the shop has it. Empty until then. */
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  /**
   * The editor's working copy: the customer's own file, and where they have
   * put it in the frame.
   *
   * It lives on the PAGE rather than inside the dialog because a closed
   * dialog's content is unmounted — so somebody who pressed Change to nudge
   * the zoom would find their photograph gone and every slider back at the
   * start. What crosses to the shop is neither of these: it is the flattened
   * frame the editor paints from them.
   */
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoDraft, setPhotoDraft] = useState<PhotoPrintDraft>(emptyPhotoPrintDraft);
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

  /**
   * The two kinds of group, told apart once.
   *
   * A real choice needs a heading and a row of buttons; an add-on is one small
   * tick, and the ticks belong together on a line rather than stacked down the
   * page with a name each. Split here rather than inside the render so the
   * decision is made in one place and both lists are ordered exactly as the
   * shop arranged them.
   */
  const addOnGroups = useMemo(
    () =>
      visibleVariantGroups
        .map((group) => ({ group, addOn: asAddOn(group) }))
        .filter(
          (entry): entry is { group: ProductVariantGroup; addOn: NonNullable<ReturnType<typeof asAddOn>> } =>
            entry.addOn !== null,
        ),
    [visibleVariantGroups],
  );
  const choiceGroups = useMemo(
    () => visibleVariantGroups.filter((group) => asAddOn(group) === null),
    [visibleVariantGroups],
  );

  /** The selectors the storefront tests hang the module gates off. */
  function gatesFor(group: ProductVariantGroup) {
    return {
      "data-gate-shape": group.type === "shape" ? "" : undefined,
    };
  }

  /** Only what the customer could see, and only what the shop will charge for. */
  const visibleSelections = useMemo(() => {
    const allowed = new Set(visibleVariantGroups.map((group) => group.id));
    return Object.fromEntries(
      Object.entries(variantSelections).filter(([groupId]) => allowed.has(groupId))
    );
  }, [visibleVariantGroups, variantSelections]);

  /**
   * What the shop can actually say about getting this to the customer.
   *
   * Three bullets at most, and each is a fact rather than a policy paragraph:
   * the promise the shop configured, the slot this customer has picked, and
   * the message card — which is offered only where the product takes one,
   * because it was once promised to every buyer of a phone charger.
   *
   * The reference storefronts pad this out with courier terms and
   * redirection policies. There is no field behind any of that here, and a
   * paragraph of invented policy is worse than a short list of true ones.
   */
  const deliveryNotes = [
    deliveryPromise,
    deliveryDate
      ? `Scheduled delivery on ${formatDate(deliveryDate)}${deliveryTime ? ` between ${deliveryTime}` : ""}`
      : "",
    cake.allowsMessage !== false ? "Custom message card included at no extra charge" : "",
  ].filter((note) => note.trim().length > 0);

  /**
   * The whole section hides when the shop has filled in none of it.
   *
   * `deliveryNotes` is never empty in practice — the slot is always picked —
   * so this is really asking whether there is anything to READ beyond the
   * delivery line, and a product with nothing said about it gets no heading.
   */
  const hasDescription = Boolean(
    productFacts.length > 0 ||
      cake.ingredients ||
      cake.allergens ||
      careNotes.length > 0 ||
      cake.description,
  );

  /**
   * Who each size feeds, for the panel behind “Serving Info”.
   *
   * Only the tiers the shop actually answered for. `serves` is optional per
   * size, so a shop that prices by size without claiming a headcount gets no
   * link rather than a panel of blanks.
   */
  const servingInfo = weightOptions
    .map((option) => ({ label: option.label, serves: option.serves?.trim() ?? "" }))
    .filter((row) => row.serves.length > 0);
  const [servingInfoOpen, setServingInfoOpen] = useState(false);
  /**
   * The two forms, behind the bar that invites them.
   *
   * Both stood open at all times, so the page ended in two long forms most
   * visitors will never fill in — between them and the reviews they came to
   * read. The bar is the affordance and it says exactly what it does, so
   * nothing is hidden: asking is still one click, and it is a click somebody
   * makes on purpose.
   */
  /**
   * The countdown, and why it is null until the browser has it.
   *
   * The server has no idea what time it is where the customer is, and a
   * server-rendered clock would be wrong from the moment it was sent — so
   * this starts empty and fills in after mount. It also stops on its own
   * when the cutoff passes, which is the whole point: a timer that has run
   * out is worse than none, because it is still telling somebody to hurry
   * for a delivery they can no longer have.
   */
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  const [askOpen, setAskOpen] = useState(false);  const [reviewOpen, setReviewOpen] = useState(false);

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


  /**
   * NO CATEGORY STRING-MATCHING, and no egg claim at all any more.
   *
   * This read `category.toLowerCase().includes("eggless")` and
   * `.includes("photo")` — so what a shop had NAMED a category decided what
   * the page claimed about the product and which controls it offered. A
   * category called “Photo Frames” got a photo-cake uploader; one called
   * “Eggless Sponges” had every product in it described as made without eggs,
   * whatever the product said. That was business-type control by another name,
   * decided by a word the shop typed for its own filing.
   *
   * The eggless half then went further: the page no longer says a product is
   * made without eggs at all. That is a claim about a recipe, and the shop
   * makes it in the name, the description and the ingredients — where it can
   * be worded, qualified and corrected — rather than in a badge this software
   * derives. An eggless VERSION is an ordinary priced option, and the buy box
   * renders it as a tickbox like any other.
   *
   * The photo half then went the same way. It used to be an OPTION too — a
   * "Standard design / Custom photo print +₹250" row a customer chose
   * between — so the uploader appeared when either the product's own flag
   * said so OR the paid option had been picked. A product that takes a
   * photograph takes one; what printing costs is part of what the product
   * costs, and the shop prices it in. One flag is the whole statement.
   */
  const showPhotoUpload = cake.allowsPhotoUpload === true && modules.photoCake;
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
      // The same read the offers already do, for the tax line under the price.
      setCommerce(getCommerceSettings());
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
    const cutoff = commerce.sameDayCutoff;
    // No clearing here: the render is gated on the cutoff as well, so a shop
    // that empties the field stops showing a countdown without this effect
    // having to write state to say so.
    if (!cutoff) return;

    const tick = () => setTimeLeft(timeLeftToday(cutoff, new Date()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [commerce.sameDayCutoff]);

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
  async function handlePhotoUpload(file: File): Promise<boolean> {
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
        /*
          The photo already attached is LEFT ALONE.

          This cleared it, so a customer who pressed Change, picked a new
          photograph and hit a flaky connection lost the one they already
          had — for a change they never completed. A failed replacement is
          not a removal.
        */
        toast.error(parsed?.message ?? "Could not upload that photo");
        return false;
      }

      setPhotoUrl(parsed.data.url);
      toast.success("Photo attached");
      return true;
    } catch {
      toast.error("Could not reach the shop", {
        description: "Please check your connection and try again.",
      });
      return false;
    } finally {
      setPhotoUploading(false);
    }
  }

  /**
   * The finished frame, on its way to the shop.
   *
   * The editor hands over a flattened JPEG and this puts it through the same
   * upload the file input used. The dialog closes only once the shop
   * actually has it — a failure leaves it open with the photograph and the
   * name still in place, so the customer tries again rather than starts
   * again.
   */
  async function handlePhotoReady(file: File) {
    if (await handlePhotoUpload(file)) setPhotoEditorOpen(false);
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
      /*
        Gated the way `weight` above it is gated, and for the same reason.

        `showPhotoUpload` is not only the module switch — it follows the
        VARIANT too: a shop's photo group ships as “Standard design” (+0) and
        “Custom photo print” (+₹250). Somebody who picked the paid one,
        uploaded a photograph, then thought better of the money and switched
        back made the whole control disappear — and this line put the photo on
        the cart line anyway. The kitchen got something to print on an order
        that was never charged for it.
      */
      photoUrl: (showPhotoUpload && photoUrl) || undefined,
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
              <ProductGallery
                images={galleryImages}
                productName={cake.name}
                badge={cake.badge}
              />
              {/*
                The shop's own caveat about its own photos.

                A handmade item varies from the picture and a sealed one does
                not, so this is a claim only the shop can make. Blank until an
                owner writes it, and nothing is printed while it is — which is
                the right answer for most trades.
              */}
              {commerce.productImageNote ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">NOTE:</span>{" "}
                  {commerce.productImageNote}
                </p>
              ) : null}
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {cake.category ? <Badge variant="accent">{cake.category}</Badge> : null}
                </div>
                <h2 className="font-heading text-3xl font-bold sm:text-4xl">{cake.name}</h2>
                {cake.rating ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <StarRating rating={cake.rating} size="md" showValue />
                    {reviews.length ? <span>({reviews.length} reviews)</span> : null}
                  </div>
                ) : null}
                {/*
                  The description moved into Product Description, below.

                  A paragraph of prose stood directly between the product name
                  and the price block — the two things a customer opens this
                  page for — and pushed the size picker and the add-ons below
                  the fold on a phone.
                */}
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
                  THE OPPOSITE OF WHAT THE REFERENCE SAYS, because it is what
                  this pipeline does.

                  Winni prints “Inclusive of all taxes” under the price. Copying
                  that here would be a lie: `computeTaxAmount` returns tax as a
                  SEPARATE line and the total is `subtotal + … + tax`, so the
                  number above this sentence is the pre-tax one. The invoice
                  terms were rewritten for exactly this reason once already —
                  they used to say “GST is included where applicable” over a
                  breakdown that printed it separately.

                  Shown only where the shop has switched tax on, and named with
                  the shop's own label rather than a hard-coded “GST”.
                */}
                {commerce.taxEnabled ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {commerce.taxLabel} added at checkout
                  </p>
                ) : null}
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
                  <OptionGroup
                    label={sizeAxisLabel}
                    count={weightOptions.length}
                    aside={
                      /*
                        WHO EACH SIZE FEEDS, on the one control where the
                        question is asked. The line under the price answers it
                        for the selected size only, and a customer choosing
                        between three sizes is comparing, not reading one.

                        Only where the shop has actually said. `serves` is
                        optional per tier, so a shop that prices by size without
                        claiming a headcount gets no link at all rather than an
                        empty panel.
                      */
                      servingInfo.length > 0 ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-bakery-700 hover:underline"
                          onClick={() => setServingInfoOpen((open) => !open)}
                        >
                          Serving Info
                        </button>
                      ) : null
                    }
                  >
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
                    {servingInfoOpen ? (
                      <ul className="space-y-1 rounded-lg border border-border bg-cream-50 p-3 text-xs text-muted-foreground">
                        {servingInfo.map((row) => (
                          <li key={row.label}>
                            <span className="font-medium text-foreground">{row.label}</span> —
                            {" "}serves {row.serves}
                          </li>
                        ))}
                      </ul>
                    ) : null}
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
              {/*
                THE PICKERS FIRST, THEN ONE ROW OF TICKS.

                Each add-on was a block-level label, so three of them stacked
                into three lines of mostly empty space between the size picker
                and the message box — and a shop with an add-on BETWEEN two
                pickers got a tick marooned on its own line in the middle of
                them. They are one row now, wrapping when it runs out of width,
                which is what the reference storefront does and what these
                actually are: a handful of small yes-or-no extras.

                Splitting the list is what makes that possible, and it is the
                only thing it changes — a group that is a real choice still
                renders as its own labelled row of buttons, in the order the
                shop arranged them.
              */}
              {choiceGroups.map((group) => (
                <div key={group.id} className="contents" {...gatesFor(group)}>
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
              ))}

              {addOnGroups.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  {addOnGroups.map(({ group, addOn }) => (
                    <label
                      key={group.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                      {...gatesFor(group)}
                    >
                      <Checkbox
                        checked={variantSelections[group.id] === addOn.on.id}
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
                  ))}
                </div>
              ) : null}

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
                  {/*
                    ONE control, and it opens an editor.

                    It was a bare file input: whatever the camera produced
                    went to the shop at whatever crop, and nobody — customer
                    or baker — saw what would be printed until it was. A
                    round print area cuts the corners off a rectangular
                    photograph, so the customer is the only person who can
                    say which corners are the expendable ones.
                  */}
                  <button
                    type="button"
                    onClick={() => setPhotoEditorOpen(true)}
                    className="flex w-full items-center gap-3 rounded-md border border-input bg-card px-3 py-2.5 text-left transition-premium hover:border-bakery-300"
                  >
                    {photoUrl ? (
                      <>
                        <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border">
                          <OptimizedImage
                            src={photoUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="36px"
                          />
                        </span>
                        <span className="text-sm font-medium">Photo added</span>
                        <span className="ml-auto text-sm font-medium text-bakery-700">
                          Change photo or name
                        </span>
                      </>
                    ) : (
                      <>
                        <ImageUp className="size-5 shrink-0 text-bakery-700" />
                        <span className="text-sm font-medium">Upload photo and write name</span>
                      </>
                    )}
                  </button>
                  {photoUploading ? (
                    <p className="text-xs text-muted-foreground">Uploading your photo…</p>
                  ) : photoUrl ? (
                    <p className="flex items-center gap-1.5 text-xs text-green-700">
                      <Check className="size-3.5" />
                      Photo attached — it will reach the shop with your order.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Fit it in the frame, and add a name if you want one.
                    </p>
                  )}

                  <PhotoPrintEditor
                    open={photoEditorOpen}
                    onOpenChange={setPhotoEditorOpen}
                    file={photoFile}
                    onFileChange={setPhotoFile}
                    draft={photoDraft}
                    onDraftChange={setPhotoDraft}
                    shape={cake.photoFrameShape}
                    busy={photoUploading}
                    attachedUrl={photoUrl}
                    onUse={(chosen) => void handlePhotoReady(chosen)}
                    onProblem={(problem) => toast.error(problem)}
                  />
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
              {/*
                Under the button, because it is about the button.

                Null until the browser has a clock — the server does not know
                what time it is where the customer is — and null again the
                moment the cutoff passes, so it can never sit there having run
                out.
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
              {commerce.sameDayCutoff && timeLeft ? (
                <p className="text-center text-sm font-medium text-bakery-700">
                  {timeLeft} hours left for today&apos;s delivery
                </p>
              ) : null}

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
              {/*
                CARDS, and still one line each.

                The reference puts three of these under the photo with a title
                and a boast beneath it — “20M Happy Customers”, “100%
                Satisfaction”. There is no number behind either and this shop
                would be inventing both, so each card carries the one thing
                that is true and nothing under it.
              */}
              <ul className="grid gap-3 text-sm sm:grid-cols-3">
                {deliveryPromise ? (
                  <li className="flex flex-col items-center gap-2 rounded-xl border border-border bg-cream-50 p-4 text-center">
                    <Truck className="size-6 text-bakery-700" />
                    <span className="font-medium text-foreground">Timely Delivery</span>
                    <span className="text-xs text-muted-foreground">{deliveryPromise}</span>
                  </li>
                ) : null}
                {cake.allowsMessage !== false ? (
                  <li className="flex flex-col items-center gap-2 rounded-xl border border-border bg-cream-50 p-4 text-center">
                    <Gift className="size-6 text-bakery-700" />
                    <span className="font-medium text-foreground">Free message card</span>
                    <span className="text-xs text-muted-foreground">Written as you ask</span>
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
                {/*
                  ONE SECTION, the way a customer reads it.

                  This was six stacked sections, each with its own heading:
                  details, ingredients, nutrition, allergens, care, delivery.
                  Every one of them was true and every one was gated properly,
                  but six headings for six short blocks reads as six subjects
                  when it is one — what this thing is and what to know about it.

                  So it is a single Product Description with labelled parts,
                  which is what the reference storefronts do and what a customer
                  scanning for “does it have nuts” actually scans. Nothing is
                  added and nothing is invented: every part still shows only
                  where the shop filled the field, and disappears entirely when
                  none of them did.
                */}
                {hasDescription ? (
                  <DetailSection title="Product Description">
                    <div className="space-y-5 text-sm text-muted-foreground">
                      {productFacts.length > 0 ? (
                        <div>
                          <p className="mb-2 font-medium text-foreground">
                            {labels.productWord} Details:
                          </p>
                          <ul className="list-disc space-y-1 pl-5">
                            {productFacts.map((fact) => (
                              <li key={fact.label}>
                                {fact.label}: {fact.value}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {cake.ingredients ? (
                        <div>
                          <p className="mb-2 font-medium text-foreground">Ingredients:</p>
                          {/*
                            " This … is prepared without eggs." used to be
                            appended here from a derived flag. A shop writes
                            what is and is not in its own recipe; this box is
                            already the place for it.
                          */}
                          <p className="whitespace-pre-line">{cake.ingredients}</p>
                        </div>
                      ) : null}

                      {cake.allergens ? (
                        <div>
                          <p className="mb-2 font-medium text-foreground">Allergens:</p>
                          <p className="whitespace-pre-line">{cake.allergens}</p>
                        </div>
                      ) : null}

                      {deliveryNotes.length > 0 ? (
                        <div>
                          <p className="mb-2 font-medium text-foreground">Delivery Information:</p>
                          <ul className="list-disc space-y-1 pl-5">
                            {deliveryNotes.map((note) => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {/*
                        Bulleted, because a shop writes these as a list and it
                        was reading as one run-on paragraph. One line typed is
                        one bullet — no new field, and a shop that wrote a
                        single sentence still gets a single bullet.
                      */}
                      {careNotes.length > 0 ? (
                        <div>
                          <p className="mb-2 font-medium text-foreground">Care Instructions:</p>
                          <ul className="list-disc space-y-1 pl-5">
                            {careNotes.map((note) => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {/*
                        The shop's own words, LAST rather than under the title.

                        It sat directly beneath the product name, above the
                        price — so a paragraph of prose stood between the
                        customer and the two things they came for. It belongs
                        with the rest of what the shop has to say.
                      */}
                      {cake.description ? (
                        <p className="whitespace-pre-line">{cake.description}</p>
                      ) : null}
                    </div>
                  </DetailSection>
                ) : null}

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
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-cream-50 px-4 py-3">
                      <p className="text-sm font-medium">
                        Didn&apos;t find the answer you were looking for?
                      </p>
                      <Button
                        type="button"
                        variant="bakery"
                        size="sm"
                        onClick={() => setAskOpen((open) => !open)}
                      >
                        Ask us
                      </Button>
                    </div>
                    {askOpen ? (
                      <ProductQuestionForm
                        productSlug={cake.slug}
                        productName={cake.name}
                      />
                    ) : null}
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
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-cream-50 px-4 py-3">
                      <p className="text-sm font-medium">Ordered this before?</p>
                      <Button
                        type="button"
                        variant="bakery"
                        size="sm"
                        onClick={() => setReviewOpen((open) => !open)}
                      >
                        Write a review
                      </Button>
                    </div>
                    {reviewOpen ? (
                      <ProductReviewForm
                        productSlug={cake.slug}
                        cakeName={cake.name}
                        onSubmitted={() => {
                          setReviewOpen(false);
                          // A new review is pending, so this re-read normally
                          // comes back unchanged — which is the honest outcome.
                          // It runs so that anything approved since the page
                          // loaded appears.
                          void getProductReviews(cake).then((next) => {
                            if (next) setReviews(next);
                          });
                        }}
                      />
                    ) : null}
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
