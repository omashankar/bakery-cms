"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
/* Still the wishlist heart — only the buy button went. */
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/storefront/price-display";
import type { LandingProduct } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { isInWishlist, toggleWishlist } from "@/apps/website/lib/wishlist";
import {
  defaultProductUnitPrice,
  displayCompareAtPrice,
} from "@/features/products/lib/product-pricing";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useBusinessLabels } from "@/hooks/use-business-labels";

interface ProductCardProps {
  cake: LandingProduct;
  variant?: "default" | "tall";
  className?: string;
  /**
   * The buy button, which not every row wants.
   *
   * DEFAULTS TO SHOWN, so every surface that had it keeps it — the
   * wishlist, where adding to the cart is the entire point of the page, and
   * the collection and search grids, where a customer is already choosing.
   */
  /**
   * The wishlist heart, which the rows still want.
   *
   * DEFAULTS TO SHOWN, so the collection grid, search and the wishlist
   * itself keep it. The homepage rows turn it off: the shop asked for it to
   * live on the listing and the product page instead, which are the two
   * places a customer is comparing rather than passing by.
   *
   * Separate from `showAddToCart` rather than folded into one "browsing"
   * flag, because the two are genuinely independent — a row can want the
   * heart and not the button.
   */
  showWishlist?: boolean;
}

export function ProductCard({
  cake,
  variant = "default",
  className,
  showWishlist = true,
}: ProductCardProps) {
  const labels = useBusinessLabels();
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
  // The card price already includes each group’s DEFAULT option — this shop’s
  // eggless cakes default to an option that adds money — so the compare-at has
  // to move with it or the card advertises a discount computed against the
  // wrong basis.
  const compareAt = displayCompareAtPrice(cake.price, cake.compareAtPrice, price);

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

  return (
    <article
      className={cn(
        /*
          A SHADOW AT REST, not only on hover.

          The card carried a 1px border and nothing else until a pointer
          touched it, so a grid of four read as four rectangles ruled onto
          the background — and on a phone, where there is no hover at all,
          that was the only state there was. The border goes almost away in
          exchange: two ways of separating a card from its ground is one
          too many, and the box drawn round each picture was the heavier.
        */
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
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
            /*
              THE GRID CHANGED, so this had to. It claimed 25vw from 1024 up
              where the grid was three across, and 50vw below 640 where the
              grid was ONE — so the browser fetched a half-width file for a
              full-width card on every phone. The listing grid is now 2 / 3 at
              md / 4 at xl, and these are those widths.
            */
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover"
          />
        </Link>
        {cake.badge ? (
          <Badge variant="accent" className="absolute top-2.5 left-2.5 shadow-sm">
            {cake.badge}
          </Badge>
        ) : null}
        {showWishlist ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            /*
              `size-7` is 28px and every guideline asks for 44. The pseudo
              element grows the HIT AREA by 8px a side without moving the
              circle a customer sees, which is why it is `after:` rather than
              padding: padding would make the button itself 44px and the card
              would gain a visibly larger blob.
            */
            className="absolute top-2.5 right-2.5 border border-border bg-card/95 shadow-sm after:absolute after:-inset-2 after:content-['']"
            onClick={handleWishlist}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={cn("size-4", wishlisted && "fill-bakery-700 text-bakery-700")} />
          </Button>
        ) : null}
        {/*
          THE RATING, ON THE PICTURE.

          It sat in the price row, at the other end from the price. The shop
          pointed at a listing where it sits low-left ON the photograph and
          asked for that — and it is the better place for a second reason:
          the price row now carries a price, a struck-through price and a
          discount, and a fourth thing on that line is a scrum.

          THE COUNT IS ONLY DRAWN IF THERE IS ONE. A rating with no reviews
          behind it is a number this shop has not earned, and `(0)` beside
          it reads worse than nothing at all.
        */}
        {cake.rating ? (
          <span
            className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-md border border-border bg-card/95 px-1.5 py-0.5 text-[11px] font-semibold text-foreground shadow-sm"
            aria-label={
              cake.reviewCount
                ? `Rated ${cake.rating} out of 5 from ${cake.reviewCount} reviews`
                : `Rated ${cake.rating} out of 5`
            }
          >
            {cake.rating}
            <Star aria-hidden="true" className="size-3 fill-green-700 text-green-700" />
            {cake.reviewCount ? (
              <span className="font-normal text-muted-foreground">
                ({cake.reviewCount.toLocaleString()})
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {/*
        LEFT, and that is a correction.

        These were centred for a day, on a reading of a reference layout that
        mixed up two different cards: the ones it centres are CATEGORY tiles —
        a name and a from-price, no product behind them — while its product
        cards, the ones with a name, a price and a rating, are ranged left.
        This is a product card.

        Ranged left is also the better of the two here regardless: a name that
        wraps to two lines centres its second line under its first, and four
        of those across a row have four different shapes.
      */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/*
          NO CATEGORY OVER THE NAME.

          It was a small uppercase line above every product — ENGAGEMENT CAKE,
          PHOTO CAKES — and the shop asked for it to go. It is worth saying
          why it is no loss: on a row the customer reached BY category, it
          repeats the heading four times; and the card already links to the
          product, where the category is on the page it lands on.

          The wrapper stays. It holds the name, and the name alone wraps to
          two lines, so the div is what keeps the price pinned to the bottom
          of a card whose neighbour has a one-line name.
        */}
        <div>
          <h3 className="font-heading text-sm font-semibold leading-snug">
            <Link
              href={routes.store.cake(cake.slug)}
              className="line-clamp-2"
            >
              {cake.name}
            </Link>
          </h3>
        </div>

        {/*
          NO BUY BUTTON ON A CARD, ANYWHERE. The shop asked for it, and the
          card is the better argument: every choice that makes one of these a
          thing somebody wants — size, flavour, a message, a photograph — is
          made on the product page, and the card cannot ask. A grid add was
          always priced AS a set of choices the customer had not seen, and
          they met them for the first time on the invoice.

          It was 24 solid full-width buttons on the shop-all page. The card
          itself is the link.
        */}
        <div className="mt-auto space-y-1">
          <PriceDisplay price={price} compareAtPrice={compareAt} size="sm" />
          {outOfStock ? (
            /*
              STILL SAYS SO. The button used to carry this, and without
              something here a customer taps through to a product page to find
              it unavailable — sent there by us, with the card giving no hint.
            */
            <p className="text-xs font-medium text-muted-foreground">Out of stock</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
