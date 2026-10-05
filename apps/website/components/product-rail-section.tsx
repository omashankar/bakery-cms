"use client";

import Link from "next/link";
import { ProductCard } from "@/components/storefront/product-card";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import { Button } from "@/components/ui/button";
import type { LandingProduct } from "@/constants/landing-data";
import { storefrontHeading } from "@/constants/typography";
import { routes } from "@/constants/routes";

interface ProductRailSectionProps {
  title: string;
  description?: string;
  cakes: LandingProduct[];
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}

export function ProductRailSection({
  title,
  description,
  cakes,
  viewAllHref = routes.store.collections,
  viewAllLabel = "View all",
  className,
}: ProductRailSectionProps) {
  if (cakes.length === 0) return null;

  return (
    <section className={className}>
      <ScrollReveal className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className={storefrontHeading.row}>{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {viewAllHref ? (
          <Button variant="ghost" render={<Link href={viewAllHref} />}>
            {viewAllLabel}
          </Button>
        ) : null}
      </ScrollReveal>
      {/* Two across from the base — see the note on the product page's
          recommendations. The base gap drops to 16px because 24 was written
          for one stacked column and costs each of two cards 6px at 360. */}
      <StaggerReveal className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {cakes.map((cake) => (
          <ProductCard key={cake.id} cake={cake} />
        ))}
      </StaggerReveal>
    </section>
  );
}
