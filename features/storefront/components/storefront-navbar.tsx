"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MegaMenu, MobileShopLinks } from "@/components/storefront/mega-menu";
import { brandInfo } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { getCartItemCount } from "@/features/storefront/lib/cart";
import { getWishlistCount } from "@/features/storefront/lib/wishlist";
import {
  getCustomerDisplayName,
  hasCustomerSession,
} from "@/features/storefront/account/lib/customer-session";
import { getStorefrontBrandInfo } from "@/features/storefront/lib/settings";
import {
  getStorefrontHeaderSettings,
  getStorefrontNavItems,
} from "@/features/storefront/lib/site-layout";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { cn } from "@/lib/utils";

export function StorefrontNavbar() {
  const [siteName, setSiteName] = useState(brandInfo.name);
  const [logoLetter, setLogoLetter] = useState("M");
  const [navItems, setNavItems] = useState(() => getStorefrontNavItems());
  const [showSearch, setShowSearch] = useState(true);
  const [showCta, setShowCta] = useState(true);
  const [ctaLabel, setCtaLabel] = useState("Order Inquiry");
  const [ctaHref, setCtaHref] = useState<string>(routes.store.contact);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const header = getStorefrontHeaderSettings();
    setSiteName(getStorefrontBrandInfo().name);
    setLogoLetter(header.logoLetter || "M");
    setNavItems(getStorefrontNavItems());
    setShowSearch(header.showSearch);
    setShowCta(header.showCta);
    setCtaLabel(header.ctaLabel);
    setCtaHref(header.ctaHref);
    setCartCount(getCartItemCount());
    setWishlistCount(getWishlistCount());
    setSignedIn(hasCustomerSession());
    setCustomerName(getCustomerDisplayName());
  }, []);

  useEffect(() => {
    const refreshCounts = () => {
      setCartCount(getCartItemCount());
      setWishlistCount(getWishlistCount());
      setSignedIn(hasCustomerSession());
      setCustomerName(getCustomerDisplayName());
    };
    window.addEventListener("storage", refreshCounts);
    window.addEventListener("bakery-cart-updated", refreshCounts);
    window.addEventListener("bakery-wishlist-updated", refreshCounts);
    window.addEventListener("bakery-customer-session-updated", refreshCounts);
    return () => {
      window.removeEventListener("storage", refreshCounts);
      window.removeEventListener("bakery-cart-updated", refreshCounts);
      window.removeEventListener("bakery-wishlist-updated", refreshCounts);
      window.removeEventListener("bakery-customer-session-updated", refreshCounts);
    };
  }, [pathname]);

  const accountHref = signedIn ? routes.account.dashboard : routes.account.login;
  const accountLabel = signedIn ? `${customerName}'s account` : "Account";

  useBodyScrollLock(mobileOpen);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setMobileOpen(false);
    }
    media.addEventListener("change", onChange);
    if (media.matches) setMobileOpen(false);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-white transition-colors",
        scrolled ? "border-border" : "border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={routes.store.home} className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-bakery-700 shadow-sm">
            <span className="font-heading text-sm font-bold text-white">
              {logoLetter}
            </span>
          </div>
          <span className="font-heading text-lg font-bold tracking-tight text-foreground">
            {siteName}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <MegaMenu
            isActive={
              pathname === routes.store.collections || pathname.startsWith(`${routes.store.collections}/`)
            }
          />
          {navItems
            .filter((item) => item.href !== routes.store.collections && item.href !== routes.store.home)
            .map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== routes.store.home && pathname.startsWith(item.href));
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-premium",
                  isActive
                    ? "bg-cream-100 text-bakery-700"
                    : "text-muted-foreground hover:bg-cream-100 hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          {showSearch ? (
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:flex"
              render={<Link href={routes.store.search} aria-label="Search" />}
            >
              <Search className="size-4" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="relative hidden sm:flex"
            render={<Link href={routes.store.wishlist} aria-label="Wishlist" />}
          >
            <Heart className="size-4" />
            {wishlistCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-bakery-700 text-[10px] font-bold text-white">
                {wishlistCount > 9 ? "9+" : wishlistCount}
              </span>
            ) : null}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            render={<Link href={routes.store.cart} aria-label="Shopping cart" />}
          >
            <ShoppingBag className="size-4" />
            {cartCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-bakery-700 text-[10px] font-bold text-white">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            ) : null}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:flex"
            render={<Link href={accountHref} aria-label={accountLabel} />}
          >
            <User className="size-4" />
          </Button>
          {showCta ? (
            <Button
              size="sm"
              className="hidden md:inline-flex"
              render={<Link href={ctaHref} />}
            >
              {ctaLabel}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="storefront-mobile-nav"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id="storefront-mobile-nav"
          className="border-t border-border bg-white lg:hidden"
        >
          <nav className="flex flex-col gap-1 px-4 py-4" aria-label="Mobile navigation">
            <Link
              href={routes.store.home}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-medium",
                pathname === routes.store.home ? "bg-cream-100 text-bakery-700" : "hover:bg-cream-100"
              )}
            >
              Home
            </Link>
            <MobileShopLinks onNavigate={() => setMobileOpen(false)} />
            {navItems
              .filter((item) => item.href !== routes.store.collections && item.href !== routes.store.home)
              .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium",
                    isActive ? "bg-cream-100 text-bakery-700" : "hover:bg-cream-100"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                render={<Link href={routes.store.wishlist} onClick={() => setMobileOpen(false)} />}
              >
                <Heart className="size-4" />
                Wishlist
              </Button>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={routes.store.cart} onClick={() => setMobileOpen(false)} />}
              >
                <ShoppingBag className="size-4" />
                Cart{cartCount > 0 ? ` (${cartCount})` : ""}
              </Button>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={accountHref} onClick={() => setMobileOpen(false)} />}
              >
                <User className="size-4" />
                {signedIn ? "My Account" : "Account"}
              </Button>
            </div>
            {showSearch ? (
              <Link
                href={routes.store.search}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-cream-100"
              >
                <Search className="size-4" />
                Search
              </Link>
            ) : null}
            {showCta ? (
              <Button
                className="mt-2"
                render={<Link href={ctaHref} onClick={() => setMobileOpen(false)} />}
              >
                {ctaLabel}
              </Button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
