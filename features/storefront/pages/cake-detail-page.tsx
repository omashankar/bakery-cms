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
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { addToCart } from "@/features/storefront/lib/cart";
import {
  getCakeWeightOptions,
  getAllCakes,
} from "@/features/storefront/lib/catalog";
import { ProductReviewForm } from "@/features/storefront/components/product-review-form";
import { REVIEWS_UPDATED_EVENT } from "@/features/admin/reviews/lib/reviews-repository";
import {
  getCakeFlavourOptions,
  getCakeGalleryImages,
  getCakeReviews,
  getCakeShapeOptions,
  getCakeVariantGroups,
  getDeliveryTimeSlots,
  getMinDeliveryDate,
  getProductDetailBadges,
  type ProductReview,
} from "@/features/storefront/lib/product-details";
import {
  calculateProductUnitPrice,
  formatVariantSummary,
} from "@/features/storefront/lib/product-pricing";
import { getDefaultVariantSelections } from "@/features/admin/cakes/lib/variant-utils";
import { isInWishlist, toggleWishlist } from "@/features/storefront/lib/wishlist";
import { getRecommendedCakes } from "@/features/storefront/lib/recommended-cakes";
import { recordRecentlyViewedCake } from "@/features/storefront/lib/recently-viewed";
import { ProductRailSection } from "@/features/storefront/components/product-rail-section";
import type { LandingCake } from "@/constants/landing-data";
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

interface CakeDetailPageProps {
  cake: LandingCake;
}

export function CakeDetailPage({ cake }: CakeDetailPageProps) {
  const router = useRouter();
  const weightOptions = useMemo(() => getCakeWeightOptions(cake), [cake]);
  const flavourOptions = useMemo(() => getCakeFlavourOptions(cake), [cake]);
  const shapeOptions = useMemo(() => getCakeShapeOptions(cake), [cake]);
  const variantGroups = useMemo(() => getCakeVariantGroups(cake), [cake]);
  const detailBadges = useMemo(() => getProductDetailBadges(cake), [cake]);
  const galleryImages = useMemo(() => getCakeGalleryImages(cake), [cake]);
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
  const [photoName, setPhotoName] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  // Related/recommended lists merge localStorage-backed admin cakes (absent during
  // SSR) — gate them behind mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const weight = weightOptions[selectedWeight] ?? weightOptions[0];
  const weightPrice =
    cake.weights?.[selectedWeight]?.price ?? cake.price + (weight?.modifier ?? 0);
  const displayPrice = useMemo(
    () =>
      calculateProductUnitPrice({
        basePrice: cake.price,
        weightPrice,
        variantGroups,
        variantSelections,
      }),
    [cake.price, weightPrice, variantGroups, variantSelections]
  );
  const variantSummary = useMemo(
    () => formatVariantSummary(variantGroups, variantSelections),
    [variantGroups, variantSelections]
  );
  const eggGroup = variantGroups.find((group) => group.type === "egg");
  const selectedEggOption = eggGroup?.options.find(
    (option) => option.id === variantSelections[eggGroup.id]
  );
  const photoGroup = variantGroups.find((group) => group.type === "photo");
  const selectedPhotoOption = photoGroup?.options.find(
    (option) => option.id === variantSelections[photoGroup.id]
  );
  const isEggless =
    selectedEggOption?.label.toLowerCase().includes("eggless") ||
    cake.isEggless ||
    cake.category.toLowerCase().includes("eggless");
  const showPhotoUpload =
    cake.allowsPhotoUpload === true ||
    cake.category.toLowerCase().includes("photo") ||
    selectedPhotoOption?.label.toLowerCase().includes("photo") === true;
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
    setVariantSelections(getDefaultVariantSelections(getCakeVariantGroups(cake)));
    setSelectedFlavour(getCakeFlavourOptions(cake)[0] ?? "");
    setSelectedShape(getCakeShapeOptions(cake)[0] ?? "Round");
    setSelectedWeight(0);
  }, [cake.slug]);

  // Same-category first, then top up from the wider catalogue so this row always
  // shows a full set of 4 — never a lone card floating in an empty grid.
  const related = useMemo(() => {
    const all = getAllCakes().filter((item) => item.slug !== cake.slug);
    const sameCategory = all.filter((item) => item.category === cake.category);
    const seen = new Set(sameCategory.map((item) => item.slug));
    const others = all.filter((item) => !seen.has(item.slug));
    return [...sameCategory, ...others].slice(0, 4);
  }, [cake.slug, cake.category]);
  const recommended = useMemo(
    () =>
      getRecommendedCakes({
        limit: 4,
        excludeSlugs: [cake.slug, ...related.map((item) => item.slug)],
      }),
    [cake.slug, related]
  );

  useEffect(() => {
    recordRecentlyViewedCake(cake.slug);
  }, [cake.slug]);

  useEffect(() => {
    function refreshReviews() {
      setReviews(getCakeReviews(cake));
    }
    refreshReviews();
    window.addEventListener(REVIEWS_UPDATED_EVENT, refreshReviews);
    return () => window.removeEventListener(REVIEWS_UPDATED_EVENT, refreshReviews);
  }, [cake]);

  const handleAddToCart = (redirectToCart = false) => {
    if (isOutOfStock) {
      toast.error("This cake is currently out of stock");
      return;
    }

    addToCart({
      cakeSlug: cake.slug,
      name: cake.name,
      image: cake.image,
      price: displayPrice,
      quantity,
      weight: weight?.label,
      flavour: selectedFlavour,
      shape: selectedShape,
      message: message.trim() || undefined,
      deliveryDate,
      deliveryTime,
      variantSelections,
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
                  {isEggless ? (
                    <Badge variant="outline" className="gap-1">
                      <Leaf className="size-3" />
                      Eggless
                    </Badge>
                  ) : null}
                  {cake.badge ? <Badge variant="gold">{cake.badge}</Badge> : null}
                </div>
                <h1 className="font-heading text-3xl font-bold sm:text-4xl">{cake.name}</h1>
                {cake.rating ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <StarRating rating={cake.rating} size="md" showValue />
                    {cake.reviewCount ? <span>({cake.reviewCount} reviews)</span> : null}
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

              {variantGroups.map((group) => (
                <OptionGroup key={group.id} label={group.name}>
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
              ))}

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

              {showPhotoUpload ? (
                <div className="space-y-2">
                  <Label htmlFor="photo-upload">Upload photo (photo cakes)</Label>
                  <Input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setPhotoName(event.target.files?.[0]?.name ?? "")
                    }
                  />
                  {photoName ? (
                    <p className="text-xs text-muted-foreground">Selected: {photoName}</p>
                  ) : null}
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
                    className="flex h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
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
                <li className="flex items-center gap-2">
                  <Leaf className="size-4 text-bakery-700" />
                  Eggless available
                </li>
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
                      {(reviews.length || cake.reviewCount)
                        ? ` (${reviews.length || cake.reviewCount})`
                        : ""}
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
                    cakeSlug={cake.slug}
                    cakeName={cake.name}
                    onSubmitted={() => setReviews(getCakeReviews(cake))}
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
          <Button variant="outline" className="flex-1" onClick={() => handleAddToCart(false)}>
            Add to Cart
          </Button>
          <Button variant="bakery" className="flex-1" onClick={() => handleAddToCart(true)}>
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
