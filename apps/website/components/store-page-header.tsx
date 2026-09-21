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
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  className?: string;
}

/**
 * WHERE YOU ARE, AND WHAT THIS PAGE IS.
 *
 * THE BAND IS GONE. This was a tinted, bordered block — `bg-cream-100`,
 * `border-b`, 32 to 40px of padding — carrying a breadcrumb, a 36px heading
 * and a blurb. On sixteen pages that was about 150px of chrome standing
 * between the header and anything a customer came for, and on a phone it was
 * most of the first screen.
 *
 * The shop pointed at the storefront it is drawn from: the same trail, set
 * plainly on the page, small and grey, with no box around it. So the content
 * is the same and the furniture is gone — the title still sits here, just at
 * a size that belongs to a page rather than to a banner.
 *
 * `Breadcrumb` from `components/ui` is not used any more, and that is
 * deliberate rather than an oversight. It brings a nav landmark, an ordered
 * list and its own type scale, and this is four words and a chevron; the admin
 * still uses it, where a trail can run four levels deep and the landmark earns
 * its keep. The `aria-label` and `aria-current` below are the parts that
 * actually matter to a screen reader, and they are kept.
 *
 * THE HEADING IS NEVER OPTIONAL, even where it is not drawn. The product page
 * passes `[&_h1]:sr-only` because the name is already set beside the
 * photograph — but this is that page's only `<h1>`, and a product page without
 * one is a page a search engine cannot name.
 */
export function StorePageHeader({
  title,
  description,
  breadcrumbs = [],
  className,
}: StorePageHeaderProps) {
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
                    `aria-current` on the last crumb, and no link on it. It is
                    the page being read — a link to here is a link to nowhere,
                    and the trail's whole job is to say which of these words is
                    the one you are standing on.
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

      <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
