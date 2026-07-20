"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { shopMegaMenu } from "@/constants/storefront-nav";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

interface MegaMenuProps {
  isActive?: boolean;
}

export function MegaMenu({ isActive }: MegaMenuProps) {
  return (
    <div className="group relative">
      <Link
        href={routes.store.collections}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-premium",
          isActive
            ? "bg-cream-100 text-bakery-700"
            : "text-muted-foreground hover:bg-cream-100 hover:text-foreground"
        )}
      >
        Shop
        <ChevronDown className="size-3.5 transition-transform group-hover:rotate-180" />
      </Link>

      <div className="pointer-events-none invisible absolute top-full left-0 z-50 w-[640px] pt-2 opacity-0 transition-all group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100">
        <div className="overflow-hidden rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr_200px]">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Shop by Category
              </p>
              <ul className="space-y-2">
                {shopMegaMenu.categories.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-md px-2 py-1.5 text-sm text-foreground transition-premium hover:bg-cream-100 hover:text-bakery-700"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Shop by Occasion
              </p>
              <ul className="space-y-2">
                {shopMegaMenu.occasions.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-md px-2 py-1.5 text-sm text-foreground transition-premium hover:bg-cream-100 hover:text-bakery-700"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href={shopMegaMenu.featured.href}
              className="group/card overflow-hidden rounded-xl border border-border bg-cream-50"
            >
              <div className="relative aspect-[4/5] bg-muted">
                <Image
                  src={shopMegaMenu.featured.image}
                  alt={shopMegaMenu.featured.title}
                  fill
                  className="object-cover transition-transform group-hover/card:scale-[1.02]"
                  sizes="200px"
                />
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold">{shopMegaMenu.featured.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {shopMegaMenu.featured.description}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileShopLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="space-y-1 border-t border-border pt-3">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Shop
      </p>
      {shopMegaMenu.categories.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-cream-100"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
