export interface MegaMenuLink {
  label: string;
  href: string;
  description?: string;
}

/*
  `shopMegaMenu` stood here: a hardcoded Shop menu — seven bakery category
  links, three occasion links and a fixed "Seasonal Collection" promo card with
  a stock photo of somebody else's cake.

  Every entry was a promise this file could not keep, and the file said so
  itself, in a comment above the occasions list: "These are hardcoded, and the
  catalogue they point into is not." A shop that had no `photo-cakes` category
  served a menu row that opened an empty grid; a shop that created one got no
  row at all; and a florist got five cake pages.

  All three columns read the shop's own data now — categories and occasions
  from the catalogue via `getStorefrontChrome`, and the promo card is whichever
  of the shop's categories has a picture it uploaded, or nothing. The fallback
  a brand-new shop with no categories sees is down to the two rows that are
  true for any shop at all: everything, and the best-selling of it.

  `MegaMenuLink` stays because the menu still has a shape; the DATA is what had
  no business being in constants.
*/
