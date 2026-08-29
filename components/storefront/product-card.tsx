"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, ShoppingBag, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/storefront/price-display";
import type { LandingProduct } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { addToCart } from "@/features/cart/lib/cart";
import { isInWishlist, toggleWishlist } from "@/apps/website/lib/wishlist";
import { defaultProductUnitPrice } from "@/features/products/lib/product-pricing";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProductCardProps {
  cake: LandingProduct;
  variant?: "default" | "tall";
  className?: string;
}

export function ProductCard({ cake, variant = "default", className }: ProductCardProps) {
  const [wishlisted, setWishlisted] = useState(false);
  /**
   * The price the SHOP will charge, not the base price on the record.
   *
   * With nothing selected the server still applies each variant group's default
   * option, and those defaults are not always free — this shop's eggless cakes
   * default to an option that adds ₹80. The card showed the base, the cart
   * carried the base, and checkout repriced at the last step: "Prices have
   * changed", for a choice the customer never made.
   */
  const price = defaultProductUnitPrice(cake);

  useEffect(() => {
    setWishlisted(isInWishlist(cake.slug));
  }, [cake.slug]);

  const handleWishlist = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const added = toggleWishlist(cake.slug);
    setWishlisted(added);
    toast.success(added ? "Added to wishlist" : "Removed from wishlist");
  };

  /**
   * The product page has refused this since it was written — the button is
   * disabled and reads "Out of stock". The card, which is the same action on
   * every grid in the storefront including the wishlist, added it anyway and
   * said "Added to cart".
   *
   * Checkout then blocks on it (`hasBlockingCartIssues`), so the customer got
   * as far as the address form before anything told them the cake was
   * unavailable.
   */
  const outOfStock = cake.inStock === false;

  const handleAddToCart = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (outOfStock) {
      toast.error("This cake is currently out of stock");
      return;
    }
    addToCart({
      productSlug: cake.slug,
      name: cake.name,
      image: cake.image,
      price,
      quantity: 1,
    });
    toast.success("Added to cart", { description: cake.name });
  };

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-bakery-300 hover:shadow-md",
        className
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-cream-100",
          variant === "tall" ? "aspect-[3/4]" : "aspect-square"
        )}
      >
        <Link href={routes.store.cake(cake.slug)} className="absolute inset-0">
          <OptimizedImage
            src={cake.image}
            alt={cake.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
        {cake.badge ? (
          <Badge variant="accent" className="absolute top-2.5 left-2.5 shadow-sm">
            {cake.badge}
          </Badge>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-2.5 right-2.5 border border-border bg-white/95 shadow-sm hover:bg-white"
          onClick={handleWishlist}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={cn("size-4", wishlisted && "fill-bakery-700 text-bakery-700")} />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {cake.category}
            </p>
            {cake.rating ? (
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                <Star className="size-3 fill-gold-300 text-gold-300" />
                {cake.rating}
              </span>
            ) : null}
          </div>
          <h3 className="font-heading text-sm font-semibold leading-snug">
            <Link
              href={routes.store.cake(cake.slug)}
              className="line-clamp-2 hover:text-bakery-700"
            >
              {cake.name}
            </Link>
          </h3>
        </div>

        <div className="mt-auto space-y-3">
          <PriceDisplay price={price} compareAtPrice={cake.compareAtPrice} size="sm" />
          <Button
            type="button"
            variant="bakery"
            className="h-10 w-full"
            disabled={outOfStock}
            onClick={handleAddToCart}
          >
            <ShoppingBag className="size-4" />
            {outOfStock ? "Out of stock" : "Add to Cart"}
          </Button>
        </div>
      </div>
    </article>
  );
}
