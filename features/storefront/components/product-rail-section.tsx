"use client";

import Link from "next/link";
import { ProductCard } from "@/components/storefront/product-card";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import { Button } from "@/components/ui/button";
import type { LandingCake } from "@/constants/landing-data";
import { routes } from "@/constants/routes";

interface ProductRailSectionProps {
  title: string;
  description?: string;
  cakes: LandingCake[];
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
          <h2 className="font-heading text-2xl font-bold">{title}</h2>
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
      <StaggerReveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cakes.map((cake) => (
          <ProductCard key={cake.id} cake={cake} />
        ))}
      </StaggerReveal>
    </section>
  );
}
