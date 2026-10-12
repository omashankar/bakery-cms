"use client";

import { ProductCard } from "@/components/storefront/product-card";
import { SectionHeader, sectionHeaderDraws } from "@/components/shared/section-header";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import type { LandingProduct } from "@/constants/landing-data";
import { sectionAlignOf } from "./lib/section-utils";
import { RECENTLY_VIEWED_MAX, RECENTLY_VIEWED_UPDATED_EVENT, getRecentlyViewedProducts } from "@/features/products/lib/recently-viewed";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { ScrollStrip } from "./scroll-strip";
import { type HomepageSectionRendererProps, contentString, contentNumber, SectionShell, ViewAllLink, SectionHeadingRow } from "./section-parts";

// A client component: what this visitor has looked at lives in their browser.

/**
 * WHAT THIS BROWSER HAS LOOKED AT.
 *
 * The only band on this page that is different for every visitor. It reads
 * `localStorage`, which does not exist on the server — so it starts empty,
 * on both sides of hydration, and fills in an effect. Reading during render
 * would put a row in the browser that is not in the HTML, which React
 * reports as a hydration mismatch and then throws the client tree away.
 *
 * SLUGS ARE RESOLVED AGAINST THE SHOP'S OWN RECORDS, never against anything
 * the browser holds: `getRecentlyViewedProducts` takes the catalogue as a
 * required argument because the version that did not once rendered a DEMO
 * cake's price into a customer's cart, which checkout then refused.
 *
 * A NEW VISITOR HAS LOOKED AT NOTHING, so the band draws nothing at all —
 * a heading over an empty strip is worse than no band. The builder says so
 * instead of vanishing, because a section that renders nothing cannot be
 * selected and an admin cannot fix what they cannot click.
 */
export function RecentlyViewedSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const labels = useBusinessLabels();
  const hasHeading = sectionHeaderDraws(
    contentString(c, "overline"),
    contentString(c, "title"),
  );
  const align = sectionAlignOf(c, "left");
  /*
    CLAMPED TO THE CEILING. The browser only ever keeps
    RECENTLY_VIEWED_MAX slugs — truncated on the way in as well as on the
    way out — so a shop typing twelve into the box would be promised twelve
    and shown eight, with nothing on the screen to explain the difference.
  */
  const maxCount = Math.min(
    RECENTLY_VIEWED_MAX,
    contentNumber(c, "maxCount", RECENTLY_VIEWED_MAX),
  );
  const catalogue = props.catalog;
  const [seen, setSeen] = useState<LandingProduct[]>([]);

  useEffect(() => {
    const read = () => setSeen(getRecentlyViewedProducts(catalogue ?? []));
    read();
    window.addEventListener(RECENTLY_VIEWED_UPDATED_EVENT, read);
    return () => window.removeEventListener(RECENTLY_VIEWED_UPDATED_EVENT, read);
  }, [catalogue]);

  const cakes = seen.slice(0, maxCount);
  const ctaLabel = contentString(c, "ctaLabel");
  const ctaHref = contentString(c, "ctaHref");

  if (cakes.length === 0) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props}>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          align={align}
        />
        <p
          className={cn(
            hasHeading && "mt-6",
            "rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground",
          )}
        >
          This band shows each visitor what THEY have looked at, so it is
          empty until somebody opens a {labels.productWord.toLowerCase()} page. It
          draws nothing at all on the live page while it is empty.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...props}>
      <ScrollReveal>
        <SectionHeadingRow
          align={align}
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          className="items-center"
          trailing={
            ctaHref && ctaLabel ? (
              <ViewAllLink href={ctaHref} label={ctaLabel} on={props.section.background} />
            ) : null
          }
        />
      </ScrollReveal>
      {/*
        THE SAME 24px EVERY OTHER PRODUCT ROW PUTS UNDER ITS HEADING.

        Measured across the page: trending, photo-cakes and featured all sit
        at 24; this band had 0, so its cards started against the words. The
        gap belongs to the heading, so it goes when there is none.
      */}
      <div className={cn(hasHeading && "mt-6")}>
        <ScrollStrip>
          {cakes.map((cake) => (
          <ProductCard
            key={cake.id}
            cake={cake}
            className="h-auto w-[calc((100%-1rem)/1.6)] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3.75rem)/4)]"
            showWishlist={false}
          />
        ))}
        </ScrollStrip>
      </div>
    </SectionShell>
  );
}
