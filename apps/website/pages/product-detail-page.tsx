"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
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
import {
  getProductWeightOptions,
  getDefaultProductWeightOptions,
  getAllProducts,
} from "@/features/products/lib/product-catalog";
import { ProductReviewForm } from "@/apps/website/components/product-review-form";
import { REVIEWS_UPDATED_EVENT } from "@/features/reviews/lib/reviews-repository";
import {
  getProductFlavourOptions,
  getProductGalleryImages,
  getProductReviews,
  getProductShapeOptions,
  getProductVariantGroups,
  getDeliveryTimeSlots,
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
  variantGroupsEnabledBy,
} from "@/features/products/lib/variant-utils";
import type { ModuleSettings } from "@/types/settings";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import {
  getModuleSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { getCustomerSession } from "@/apps/website/account/lib/customer-session";
import { openCustomerAuthModal } from "@/apps/website/account/components/customer-auth-modal";
import { isInWishlist, toggleWishlist } from "@/apps/website/lib/wishlist";
import { getRecommendedProducts } from "@/apps/website/lib/recommended-products";
import { recordRecentlyViewedProduct } from "@/apps/website/lib/recently-viewed";
import { ProductRailSection } from "@/apps/website/components/product-rail-section";
import type { LandingProduct } from "@/constants/landing-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency, formatDate, formatRelativeTime } from "@/utils/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProductDetailPageProps {
  cake: LandingProduct;
  /**
   * Catalogue data fetched on the server. Passing it in keeps the rendered
   * product rails identical between the server pass and the client, which the
   * old localStorage reads could not do — the server had no localStorage, so it
   * always rendered seed data and then swapped on hydration.
   */
  related?: LandingProduct[];
  catalog?: LandingProduct[];
}

export function ProductDetailPage({
  cake,
  related: relatedFromServer,
  catalog,
}: ProductDetailPageProps) {
  const router = useRouter();
  // Related/recommended lists merge localStorage-backed admin cakes (absent during
  // SSR) — gate them behind mount to avoid a hydration mismatch. weightOptions
  // shares the gate: its catalog fallback (for products without their own weights)
  // reads localStorage too, so it renders the seed defaults until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const weightOptions = useMemo(
    () =>
      cake.weights?.length || mounted
        ? getProductWeightOptions(cake)
        : getDefaultProductWeightOptions(),
    [cake, mounted]
  );
  const flavourOptions = useMemo(() => getProductFlavourOptions(cake), [cake]);
  const shapeOptions = useMemo(() => getProductShapeOptions(cake), [cake]);
  const variantGroups = useMemo(() => getProductVariantGroups(cake), [cake]);
  const detailBadges = useMemo(() => getProductDetailBadges(cake), [cake]);
  const galleryImages = useMemo(() => getProductGalleryImages(cake), [cake]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [deliverySlots, setDeliverySlots] = useState<string[]>([]);
  const [minDeliveryDate, setMinDeliveryDate] = useState("");
  const [deliveryReady, setDeliveryReady] = useState(false);

  const [selectedWeight, setSelectedWeight] = useState(0);
  const [selectedFlavour, setSelectedFlavour] = useState(flavourOptions[0] ?? "");
  const [selectedShape, setSelectedShape] = useState(shapeOptions[0] ?? "Round");
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
    cake.category.toLowerCase().includes("eggless");
  const showPhotoUpload =
    (cake.allowsPhotoUpload === true ||
      cake.category.toLowerCase().includes("photo") ||
      selectedPhotoOption?.semantic === "photo-print") &&
    modules.photoCake;
  const isOutOfStock = cake.inStock === false;

  useEffect(() => {
    const slots = getDeliveryTimeSlots();
    const minDate = getMinDeliveryDate();
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
    setSelectedShape(getProductShapeOptions(cake)[0] ?? "Round");
    setSelectedWeight(0);
  }, [cake.slug]);

  // Same-category first, then top up from the wider catalogue so this row always
  // shows a full set of 4 — never a lone card floating in an empty grid.
  const related = useMemo(() => {
    if (relatedFromServer) return relatedFromServer;
    const all = getAllProducts().filter((item) => item.slug !== cake.slug);
    const sameCategory = all.filter((item) => item.category === cake.category);
    const seen = new Set(sameCategory.map((item) => item.slug));
    const others = all.filter((item) => !seen.has(item.slug));
    return [...sameCategory, ...others].slice(0, 4);
  }, [relatedFromServer, cake.slug, cake.category]);
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
    if (!getCustomerSession()) {
      toast.info("Please sign in to attach a photo", {
        description: "It travels with your order, so it needs to belong to an account.",
      });
      openCustomerAuthModal("phone");
      return;
    }

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
      toast.error("Could not reach the bakery", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setPhotoUploading(false);
    }
  }

  const handleAddToCart = (redirectToCart = false) => {
    if (isOutOfStock) {
      toast.error("This cake is currently out of stock");
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
      shape: modules.shape ? selectedShape : undefined,
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
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <ProductGallery images={galleryImages} productName={cake.name} />

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="accent">{cake.category}</Badge>
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
                <p className="mt-2 text-sm text-muted-foreground">
                  Serves {weight?.serves ?? "8–10"} people · {weight?.label ?? "1 kg"}
                </p>
                {variantSummary.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">{variantSummary.join(" · ")}</p>
                ) : null}
              </div>

              {/* Only offered when this cake actually comes in several flavours. */}
              {modules.flavour && flavourOptions.length > 0 ? (
                <div className="contents" data-gate-flavour>
                  <OptionGroup label="Flavour">
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
                  <OptionGroup label="Weight">
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
                  <OptionGroup label={group.name}>
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
                  <OptionGroup label="Shape">
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
                  <Label htmlFor="cake-message">Cake message</Label>
                  <Textarea
                    id="cake-message"
                    placeholder='e.g. "Happy Birthday Rahul!"'
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
                      Photo attached — it will reach the bakery with your order.
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

              <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-bakery-700" />
                  Freshly baked
                </li>
                <li className="flex items-center gap-2">
                  <Truck className="size-4 text-bakery-700" />
                  Same-day delivery
                </li>
                {modules.eggEggless ? (
                  <li className="flex items-center gap-2" data-gate-egg>
                    <Leaf className="size-4 text-bakery-700" />
                    Eggless available
                  </li>
                ) : null}
              </ul>

              <Tabs defaultValue="description">
                <div className="overflow-x-auto">
                  <TabsList className="w-max min-w-full">
                    <TabsTrigger value="description">Description</TabsTrigger>
                    <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
                    <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
                    <TabsTrigger value="allergens">Allergens</TabsTrigger>
                    <TabsTrigger value="care">Care</TabsTrigger>
                    <TabsTrigger value="reviews">
                      Reviews
                      {reviews.length ? ` (${reviews.length})` : ""}
                    </TabsTrigger>
                    <TabsTrigger value="delivery">Delivery</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="description" className="text-sm text-muted-foreground">
                  {cake.description} Crafted fresh with premium ingredients and finished by
                  our expert bakers for celebrations of every size.
                </TabsContent>
                <TabsContent value="ingredients" className="text-sm text-muted-foreground">
                  {cake.ingredients ||
                    "Flour, sugar, butter, fresh cream, premium chocolate, and natural flavours."}
                  {isEggless
                    ? " This cake is prepared without eggs."
                    : " Eggless version available on request."}
                </TabsContent>
                <TabsContent value="nutrition" className="space-y-2 text-sm text-muted-foreground">
                  {cake.calories ? (
                    <p>
                      <span className="font-medium text-foreground">Calories:</span>{" "}
                      {cake.calories} kcal per serving
                    </p>
                  ) : (
                    <p>Calorie information will be updated soon.</p>
                  )}
                  {cake.preparationTimeMinutes ? (
                    <p>
                      <span className="font-medium text-foreground">Preparation:</span>{" "}
                      {detailBadges.find((badge) => badge.includes("prep")) ?? `${cake.preparationTimeMinutes} minutes`}
                    </p>
                  ) : null}
                  {cake.shelfLifeDays ? (
                    <p>
                      <span className="font-medium text-foreground">Shelf life:</span>{" "}
                      {cake.shelfLifeDays} day{cake.shelfLifeDays === 1 ? "" : "s"} when stored properly
                    </p>
                  ) : null}
                </TabsContent>
                <TabsContent value="allergens" className="text-sm text-muted-foreground">
                  {cake.allergens ||
                    "May contain milk, wheat, eggs, and nuts. Please contact us for allergen-specific requests."}
                </TabsContent>
                <TabsContent value="care" className="text-sm text-muted-foreground">
                  {cake.careInstructions ||
                    "Refrigerate within 2 hours of delivery. Bring to room temperature before serving for the best texture and flavour."}
                </TabsContent>
                <TabsContent value="reviews" className="space-y-4">
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
                            {review.isFeatured ? (
                              <Badge variant="gold">Featured</Badge>
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
                        <p className="mt-2 text-sm text-muted-foreground">{review.text}</p>
                        {review.adminReply ? (
                          <div className="mt-3 rounded-lg border border-border bg-cream-50 px-3 py-2 text-sm">
                            <p className="font-medium text-bakery-700">Response from the bakery</p>
                            <p className="mt-1 text-muted-foreground">{review.adminReply}</p>
                          </div>
                        ) : null}
                      </article>
                    ))
                  )}
                </TabsContent>
                <TabsContent value="delivery" className="text-sm text-muted-foreground">
                  Same-day delivery available for orders placed before 2 PM within city limits.
                  Scheduled delivery on {deliveryDate ? formatDate(deliveryDate) : "your selected date"}
                  {deliveryTime ? ` between ${deliveryTime}` : ""}. Custom message card included at
                  no extra charge.
                </TabsContent>
              </Tabs>
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

function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
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
