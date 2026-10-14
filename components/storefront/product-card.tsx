import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
/* Still the wishlist heart — only the buy button went. */
import { ProductCardWishlist } from "@/components/storefront/product-card-wishlist";
import { EarliestDelivery } from "@/components/storefront/earliest-delivery";
import { PriceDisplay } from "@/components/storefront/price-display";
import type { LandingProduct } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import {
  defaultProductUnitPrice,
  displayCompareAtPrice,
} from "@/features/products/lib/product-pricing";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  cake: LandingProduct;
  /**
   * Preload this card's photo, for the few that are on screen at once.
   *
   * Measured on the production build on a mid-range phone over slow 4G:
   * the LCP element on the listing and on a category is a card photo, at
   * 2752ms and 2608ms against a 2.5s budget. They are ordinary lazy
   * images, so the browser does not learn it needs the first one until it
   * has parsed and laid out the grid; on a slow connection that discovery
   * is most of the gap.
   *
   * THE CALLER DECIDES, because only the caller knows which cards are
   * first — this same component draws the wishlist, the search grid and
   * the rails, where nothing should be preloaded at all. Preloading more
   * than the first row makes it worse, not better: the extra requests
   * compete with the one that actually decides LCP.
   */
  priority?: boolean;
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
  priority,
  variant = "default",
  className,
  showWishlist = true,
}: ProductCardProps) {
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
          NO BOX ROUND THE CARD — the marketplace shape the shop pointed at.
          The picture carries its own rounded edge and the words sit under it
          on the page's ground, so a grid reads as pictures, not as a ruled
          sheet of rectangles.
        */
        "group flex h-full flex-col",
        /*
          A PANEL ON HOVER, and only then: the reference lifts the card it is
          pointing at onto white with a shadow. The negative margin gives that
          panel room to reach past the picture without moving the picture or
          breaking the grid's alignment at rest.
        */
        "-m-1.5 rounded-2xl p-1.5 transition-shadow hover:bg-card hover:shadow-lg",
        className
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-cream-100",
          variant === "tall" ? "aspect-[3/4]" : "aspect-square"
        )}
      >
        <Link href={routes.store.cake(cake.slug)} className="absolute inset-0">
          <OptimizedImage
            src={cake.image}
            alt={cake.name}
            fill
            // Next 16 deprecates `priority`; the LCP card loads eagerly and says so.
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            /*
              THE GRID CHANGED, so this had to. It claimed 25vw from 1024 up
              where the grid was three across, and 50vw below 640 where the
              grid was ONE — so the browser fetched a half-width file for a
              full-width card on every phone. The listing grid is now 2 / 3 at
              md / 4 at xl, and these are those widths.
            */
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
        {cake.badge ? (
          <Badge variant="accent" className="absolute top-2.5 left-2.5 shadow-sm">
            {cake.badge}
          </Badge>
        ) : null}
        {showWishlist ? <ProductCardWishlist slug={cake.slug} /> : null}
      </div>

      {/*
        LEFT, and that is a correction.

        These were centred for a day, on a reading of a reference layout that
        mixed up two different cards: the ones it centres are CATEGORY tiles —
        a name and a from-price, no product behind them — while its product
        cards, the ones with a name, a price and a rating, are ranged left.
      */}
      <div className="flex flex-1 flex-col gap-1.5 px-0.5 pt-2.5">
        {/*
          NO CATEGORY OVER THE NAME, and NO BUY BUTTON: the card is the link,
          and every choice that makes a cake — size, flavour, a message — is
          made on the product page, which the card cannot ask.
        */}
        <h3 className="text-sm leading-snug text-foreground sm:text-[15px]">
          <Link href={routes.store.cake(cake.slug)} className="line-clamp-2 hover:text-bakery-700">
            {cake.name}
          </Link>
        </h3>

        {/*
          THE RATING AT THE END OF THE PRICE LINE, as the shop's reference has
          it: a green pill a customer finds without looking for it. Only when
          there is one — a rating with no reviews behind it is a number this
          shop has not earned.
        */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <PriceDisplay price={price} compareAtPrice={compareAt} size="sm" className="min-w-0" />
          {cake.rating ? (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-green-700 px-1.5 py-0.5 text-xs font-semibold text-white"
              aria-label={`Rated ${cake.rating} out of 5`}
            >
              {cake.rating}
              <Star aria-hidden="true" className="size-3 fill-white text-white" />
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {outOfStock ? (
            /*
              STILL SAYS SO, in place of the delivery day it cannot have —
              without it a customer taps through to find it unavailable.
            */
            <span className="font-medium">Out of stock</span>
          ) : (
            <EarliestDelivery />
          )}
          {cake.rating && cake.reviewCount ? (
            // Not on a phone: the pill above already says there is a rating.
            <span className="hidden shrink-0 sm:inline">
              {cake.reviewCount.toLocaleString()} {cake.reviewCount === 1 ? "Review" : "Reviews"}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
