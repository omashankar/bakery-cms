"use client";

import { useCallback } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isInWishlist, toggleWishlist } from "@/apps/website/lib/wishlist";
import { useExternalValue, windowEvents } from "@/hooks/use-external-value";
import { cn } from "@/lib/utils";

const wishlistChanges = windowEvents("bakery-wishlist-updated", "storage");

/**
 * The card's wishlist heart — the only part of a product card that runs in
 * the browser. The card around it is plain markup, so a page of cards drawn
 * on the server hydrates a heart per card instead of the whole card.
 */
export function ProductCardWishlist({ slug }: { slug: string }) {
  // Read from the wishlist itself and kept in step with it, so two cards for
  // the same cake on one page (a rail and the grid) agree after either is pressed.
  const readHearted = useCallback(() => isInWishlist(slug), [slug]);
  const wishlisted = useExternalValue(readHearted, wishlistChanges, false);

  const handleWishlist = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const added = toggleWishlist(slug);
    // Loaded on the click: this card is on every listing, and the toast library
    // was in their first download for a message only a click can raise.
    void import("sonner").then(({ toast }) =>
      toast.success(added ? "Added to wishlist" : "Removed from wishlist"),
    );
  };

  return (
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
      className="absolute right-2.5 bottom-2.5 rounded-full border border-border bg-card/95 shadow-sm after:absolute after:-inset-2 after:content-['']"
      onClick={handleWishlist}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart className={cn("size-4", wishlisted && "fill-bakery-700 text-bakery-700")} />
    </Button>
  );
}
