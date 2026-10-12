"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isInWishlist, toggleWishlist } from "@/apps/website/lib/wishlist";
import { cn } from "@/lib/utils";

/**
 * The card's wishlist heart — the only part of a product card that runs in
 * the browser. The card around it is plain markup, so a page of cards drawn
 * on the server hydrates a heart per card instead of the whole card.
 */
export function ProductCardWishlist({ slug }: { slug: string }) {
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    setWishlisted(isInWishlist(slug));
  }, [slug]);

  const handleWishlist = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const added = toggleWishlist(slug);
    setWishlisted(added);
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
      className="absolute top-2.5 right-2.5 border border-border bg-card/95 shadow-sm after:absolute after:-inset-2 after:content-['']"
      onClick={handleWishlist}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart className={cn("size-4", wishlisted && "fill-bakery-700 text-bakery-700")} />
    </Button>
  );
}
