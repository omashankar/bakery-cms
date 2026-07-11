"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/storefront/price-display";
import type { LandingCake } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { isInWishlist, toggleWishlist } from "@/features/storefront/lib/wishlist";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProductCardProps {
  cake: LandingCake;
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

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-xl border border-border bg-white transition-premium hover:border-bakery-300",
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
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </Link>
        {cake.badge ? (
          <Badge variant="accent" className="absolute top-3 left-3">
            {cake.badge}
          </Badge>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3 border border-border bg-white/95 hover:bg-white"
          onClick={handleWishlist}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={cn("size-4", wishlisted && "fill-bakery-700 text-bakery-700")} />
        </Button>
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {cake.category}
          </p>
          <h3 className="font-heading text-base font-semibold leading-snug">
            <Link href={routes.store.cake(cake.slug)} className="hover:text-bakery-700">
              {cake.name}
            </Link>
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">{cake.description}</p>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="space-y-1">
            <PriceDisplay
              price={cake.price}
              compareAtPrice={cake.compareAtPrice}
              className="[&_span:first-child]:text-lg"
            />
            {cake.rating ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="size-3 fill-gold-300 text-gold-300" />
                {cake.rating}
                {cake.reviewCount ? ` (${cake.reviewCount})` : ""}
              </span>
            ) : null}
          </div>
          <Button size="sm" variant="outline" render={<Link href={routes.store.cake(cake.slug)} />}>
            View
          </Button>
        </div>
      </div>
    </article>
  );
}
