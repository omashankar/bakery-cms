"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, ShoppingBag, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/storefront/price-display";
import type { LandingProduct } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { addToCart } from "@/features/cart/lib/cart";
import { isInWishlist, toggleWishlist } from "@/features/storefront/lib/wishlist";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProductCardProps {
  cake: LandingProduct;
  variant?: "default" | "tall";
  className?: string;
}

export function ProductCard({ cake, variant = "default", className }: ProductCardProps) {
  const [wishlisted, setWishlisted] = useState(false);

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

  const handleAddToCart = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    addToCart({
      productSlug: cake.slug,
      name: cake.name,
      image: cake.image,
      price: cake.price,
      quantity: 1,
    });
    toast.success("Added to cart", { description: cake.name });
  };

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-white transition-premium hover:border-bakery-300 hover:shadow-sm",
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
          <Image
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
              className="line-clamp-1 hover:text-bakery-700"
            >
              {cake.name}
            </Link>
          </h3>
        </div>

        <div className="mt-auto space-y-3">
          <PriceDisplay
            price={cake.price}
            compareAtPrice={cake.compareAtPrice}
            className="[&_span:first-child]:text-lg [&_span:first-child]:sm:text-lg [&_span:nth-child(2)]:text-sm"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="bakery"
              className="flex-1"
              onClick={handleAddToCart}
            >
              <ShoppingBag className="size-4" />
              Add to Cart
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              render={<Link href={routes.store.cake(cake.slug)} aria-label={`View ${cake.name}`} />}
            >
              View
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
