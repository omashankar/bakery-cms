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
  ShoppingBag,
  Truck,
} from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { PriceDisplay } from "@/components/storefront/price-display";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { StarRating } from "@/components/shared/star-rating";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { addToCart } from "@/features/cart/lib/cart";
import { getProductWeightOptions } from "@/features/products/lib/product-catalog";
import { ProductReviewForm } from "@/apps/website/components/product-review-form";
import { REVIEWS_UPDATED_EVENT } from "@/features/reviews/lib/reviews-repository";
import {
  getProductFlavourOptions,
  getProductGalleryImages,
  getProductReviews,
  getProductShapeOptions,
  getDeliveryTimeSlots,
  getDeliveryPromise,
  getMinDeliveryDate,
  getProductDetailBadges,
  type ProductReview,
} from "@/apps/website/lib/product-details";
import {
  calculateProductUnitPrice,
  formatVariantSummary,
} from "@/features/products/lib/product-pricing";
import {
  getDefaultVariantSelections,
  getProductVariantGroups,
  variantGroupsEnabledBy,
} from "@/features/products/lib/variant-utils";
import type { ModuleSettings } from "@/types/settings";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
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

interface ProductDetailPageProps {
  cake: LandingProduct;
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
  related: relatedFromServer,
  catalog,
}: ProductDetailPageProps) {
  const labels = useBusinessLabels();
  const router = useRouter();
  // Related/recommended lists merge localStorage-backed admin cakes (absent during
  // SSR) — gate them behind mount to avoid a hydration mismatch.
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
  const flavourOptions = useMemo(() => getProductFlavourOptions(cake), [cake]);
  const shapeOptions = useMemo(() => getProductShapeOptions(cake), [cake]);
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
  const [deliverySlots, setDeliverySlots] = useState<string[]>([]);
  const [deliveryPromise, setDeliveryPromise] = useState("");
  const [minDeliveryDate, setMinDeliveryDate] = useState("");
  const [deliveryReady, setDeliveryReady] = useState(false);

  const [selectedWeight, setSelectedWeight] = useState(0);
  const [selectedFlavour, setSelectedFlavour] = useState(flavourOptions[0] ?? "");
  // No "Round" fallback. A product that offers no shapes has no selected shape —
  // the same empty-string convention `selectedFlavour` above already uses, and
  // what stops `addToCart` stamping a choice onto a line that never had one.
  const [selectedShape, setSelectedShape] = useState(shapeOptions[0] ?? "");
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

  // Optional bakery modules gate the bakery-specific choosers below. Default ON so
  // SSR / the bakery template render exactly as before; re-read on the client.
  const [modules, setModules] = useState<ModuleSettings>(defaultModuleSettings);
  useEffect(() => {
    const sync = () => setModules(getModuleSettings());
    sync();
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
  const isEggless =
    selectedEggOption?.semantic === "eggless" ||
    cake.isEggless ||
    (cake.category ?? "").toLowerCase().includes("eggless");
  const showPhotoUpload =
    (cake.allowsPhotoUpload === true ||
      (cake.category ?? "").toLowerCase().includes("photo") ||
      selectedPhotoOption?.semantic === "photo-print") &&
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

  useEffect(() => {
    setWishlisted(isInWishlist(cake.slug));
    setVariantSelections(getDefaultVariantSelections(getProductVariantGroups(cake)));
    setSelectedFlavour(getProductFlavourOptions(cake)[0] ?? "");
    setSelectedShape(getProductShapeOptions(cake)[0] ?? "");
    setSelectedWeight(0);
  }, [cake.slug]);

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
      // Null is a failed read, not an empty list — leave what is on screen.
      if (!cancelled && fetched) setReviews(fetched);
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

    addToCart({
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
      // Omitted entirely when this cake has no flavour choice, or when the
      // module is off — the picker is hidden in both cases, and an order line
      // must not record a choice the customer was never shown. `selectedFlavour`
      // and `selectedShape` default to the product's first option regardless of
      // the module, so without this a shop that switched Flavour off still had
      // "Chocolate" on every order line, invoice and confirmation email.
      flavour: (modules.flavour && selectedFlavour) || undefined,
      // Shape reads the same way as flavour now. It was `modules.shape ?
      // selectedShape : undefined`, and `selectedShape` fell back to the literal
      // "Round" — so a shop with the Shape module on (any shop selling cakes)
      // stamped "Round" onto every phone charger and gift hamper it sold, on the
      // order line, the invoice and the baker's email, for a picker that renders
      // nothing because the product offers no shapes.
      shape: (modules.shape && selectedShape) || undefined,
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

    toast.success("Added to cart", {
      description: `${quantity} × ${cake.name}`,
    });

    if (redirectToCart) {
      router.push(routes.store.cart);
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
                <PriceDisplay price={displayPrice} compareAtPrice={cake.compareAtPrice} />
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
              {modules.flavour && flavourOptions.length > 0 ? (
                <div className="contents" data-gate-flavour>
                  <OptionGroup label="Flavour" count={flavourOptions.length}>
                    <div className="flex flex-wrap gap-2">
                      {flavourOptions.map((flavour) => (
                        <OptionButton
                          key={flavour}
                          active={selectedFlavour === flavour}
                          onClick={() => setSelectedFlavour(flavour)}
                        >
                          {flavour}
                        </OptionButton>
                      ))}
                    </div>
                  </OptionGroup>
                </div>
              ) : null}

              {modules.weight ? (
                <div className="contents" data-gate-weight>
                  <OptionGroup label="Weight" count={weightOptions.length}>
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

              {visibleVariantGroups.map((group) => (
                <div
                  key={group.id}
                  className="contents"
                  data-gate-egg={group.type === "egg" ? "" : undefined}
                  data-gate-photo={group.type === "photo" ? "" : undefined}
                >
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

              {modules.shape ? (
                <div className="contents" data-gate-shape>
                  <OptionGroup label="Shape" count={shapeOptions.length}>
                    <div className="flex flex-wrap gap-2">
                      {shapeOptions.map((shape) => (
                        <OptionButton
                          key={shape}
                          active={selectedShape === shape}
                          onClick={() => setSelectedShape(shape)}
                        >
                          {shape}
                        </OptionButton>
                      ))}
                    </div>
                  </OptionGroup>
                </div>
              ) : null}

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

                It now uploads to `/api/uploads/photo-cake`, which requires a
                signed-in customer (checkout does too), checks the magic bytes
                rather than the browser's word for the type, caps the size, and
                stores it where the bakery can open it.
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

              <div className="hidden flex-wrap gap-3 lg:flex">
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  disabled={isOutOfStock}
                  onClick={() => handleAddToCart(false)}
                >
                  <ShoppingBag className="size-4" />
                  {isOutOfStock ? "Out of stock" : "Add to Cart"}
                </Button>
                <Button
                  size="lg"
                  variant="bakery"
                  className="flex-1"
                  disabled={isOutOfStock}
                  onClick={() => handleAddToCart(true)}
                >
                  Buy Now
                </Button>
              </div>

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
                    {deliveryPromise}. Scheduled delivery on{" "}
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
                <DetailSection
                  id="reviews"
                  title={`Reviews${reviews.length ? ` (${reviews.length})` : ""}`}
                >
                  <div className="space-y-4">
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
                        No published reviews yet. Be the first to share your experience.
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
                          {review.adminReply ? (
                            <div className="mt-3 rounded-lg border border-border bg-cream-50 px-3 py-2 text-sm">
                              <p className="font-medium text-bakery-700">Response from the shop</p>
                              <p className="mt-1 whitespace-pre-line text-muted-foreground">
                                {review.adminReply}
                              </p>
                            </div>
                          ) : null}
                        </article>
                      ))
                    )}
                  </div>
                </DetailSection>
              </div>

            </div>
          </div>

          {mounted && related.length > 0 ? (
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
            variant="outline"
            className="flex-1"
            disabled={isOutOfStock}
            onClick={() => handleAddToCart(false)}
          >
            {isOutOfStock ? "Out of stock" : "Add to Cart"}
          </Button>
          <Button
            variant="bakery"
            className="flex-1"
            disabled={isOutOfStock}
            onClick={() => handleAddToCart(true)}
          >
            Buy Now
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * A choice the customer makes. Renders nothing when there is nothing to choose.
 *
 * The label used to paint unconditionally, which was harmless only because no
 * list could be empty: `getProductWeightOptions` fell back to the shop's catalog
 * tiers and `getProductShapeOptions` to Round/Square/Heart, so the empty case
 * was dead code. Both now return `[]` for a product that declares none — which
 * is the point — and that turned the dead case into the default one: a phone
 * charger rendered a "Weight" heading over nothing and a "Shape" heading over
 * nothing, on the page a customer buys from.
 *
 * `count` is REQUIRED rather than derived from `children`, so a new group cannot
 * be added without stating how many options it has. A convention would have been
 * forgotten the same way the three above were; a required prop is a type error.
 */
function OptionGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count <= 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

/**
 * One block of product information, always visible.
 *
 * The heading is what a tab label used to be. A section renders only where the
 * shop has filled the field, so an empty one disappears rather than printing
 * somebody else’s product back at the customer.
 */
function DetailSection({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border pt-6">
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function OptionButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-4 py-2 text-sm font-medium transition-premium",
        active
          ? "border-bakery-700 bg-bakery-700 text-white"
          : "border-border bg-white hover:border-bakery-300"
      )}
    >
      {children}
    </button>
  );
}
