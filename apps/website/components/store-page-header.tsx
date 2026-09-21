import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

interface Crumb {
  label: string;
  href?: string;
}

interface StorePageHeaderProps {
  /** Kept in the document as the page's `<h1>`, and never drawn. See below. */
  title: string;
  breadcrumbs?: Crumb[];
  className?: string;
}

/**
 * WHERE YOU ARE. NOTHING ELSE.
 *
 * This was a tinted, bordered band — `bg-cream-100`, a border underneath, 32 to
 * 40px of padding — holding a breadcrumb, a 36px heading and a blurb. On
 * sixteen pages that was about 150px of furniture standing between the header
 * and anything a customer came for, and on a phone it was most of the first
 * screen. The band went first; the shop then pointed at the heading and the
 * blurb and asked for those to go too.
 *
 * WHAT THE HEADING WAS ACTUALLY SAYING is why that is right rather than merely
 * shorter. "Our Collections" sat above a grid of collections. "Shopping Cart"
 * sat above a cart. "Contact Us" sat above a contact form. The breadcrumb one
 * line above says the same word, and the page below says it by being itself —
 * so the heading was a caption on something already captioned, and the blurb
 * under it ("Browse everything we sell by category") was this software
 * narrating the shop's own page back to it.
 *
 * THE H1 STAYS IN THE DOCUMENT, AND THAT IS NOT A LOOPHOLE. A page with no
 * `<h1>` is a page a search engine cannot name and a screen-reader user cannot
 * skim — the heading is how both of them answer "what is this page", and
 * neither of them is looking at the layout the shop just tidied. So it is
 * present, correct, and `sr-only`. The product page has needed exactly this
 * arrangement all along, because its name is drawn beside the photograph; now
 * every page has it, and that page no longer needs a special class.
 *
 * THE BLURB IS GONE RATHER THAN HIDDEN. It was prose, not structure, so there
 * is nothing for a crawler to lose — and the one instance that was the shop's
 * own words rather than ours, a CMS page's description, already reaches search
 * engines as that page's meta description (`store/pages/[slug]/page.tsx`).
 * Hiding it would have left a prop that renders nothing, which is how a field
 * ends up being written, validated, carried through three layers and shown to
 * nobody.
 *
 * `Breadcrumb` from `components/ui` is not used here, deliberately: it brings a
 * nav landmark, an ordered list and its own type scale, and this is four words
 * and a chevron. The admin keeps it, where a trail runs four levels deep. The
 * `aria-label` and the `aria-current` are the parts a screen reader needs.
 */
export function StorePageHeader({ title, breadcrumbs = [], className }: StorePageHeaderProps) {
  const trail = [{ label: "Home", href: routes.store.home }, ...breadcrumbs];

  return (
    <div className={cn(layoutSpacing.container, "pt-5 sm:pt-6", className)}>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground sm:text-sm">
          {trail.map((item, index) => {
            const isLast = index === trail.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center gap-x-1.5">
                {index > 0 ? (
                  <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                ) : null}
                {isLast || !item.href ? (
                  /*
                    No link on the last crumb: it is the page being read, and a
                    link to here goes nowhere. `aria-current` is what says which
                    of these words is the one you are standing on.
                  */
                  <span aria-current="page" className="truncate">
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className="truncate underline-offset-4 hover:underline">
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <h1 className="sr-only">{title}</h1>
    </div>
  );
}
