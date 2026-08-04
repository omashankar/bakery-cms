"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MegaMenu, MobileShopLinks } from "@/components/storefront/mega-menu";
import {
  CustomerAuthModal,
  OPEN_AUTH_MODAL_EVENT,
} from "@/apps/website/account/components/customer-auth-modal";
import { AccountMenu } from "@/apps/website/account/components/account-menu";
import { GuestMenu } from "@/apps/website/account/components/guest-menu";
import { routes } from "@/constants/routes";
import { getCartItemCount } from "@/features/cart/lib/cart";
import { getWishlistCount } from "@/apps/website/lib/wishlist";
import {
  getCustomerDisplayName,
  getCustomerSession,
  hasCustomerSession,
} from "@/apps/website/account/lib/customer-session";
import type { StorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { cn } from "@/lib/utils";

interface StorefrontNavbarProps {
  chrome: StorefrontChrome;
}

export function StorefrontNavbar({ chrome }: StorefrontNavbarProps) {
  // Read on the server from MongoDB (see StorefrontChrome) — so the HTML already
  // carries the admin's real store name / logo / nav, no defaults-then-swap flash.
  const [siteName] = useState(chrome.siteName);
  const [logo] = useState(chrome.logo);
  // An admin can point this anywhere, and anywhere can 404 — a stale path, a
  // deleted upload, a CDN that moved. A broken-image glyph in the header is
  // worse than the letter mark it replaced, so fall back to it.
  const [logoBroken, setLogoBroken] = useState(false);
  const [logoLetter] = useState(chrome.logoLetter);
  const [navItems] = useState(chrome.navItems);
  const [showSearch] = useState(chrome.showSearch);
  const [cta] = useState(chrome.cta);

  /**
   * The two rows the navbar renders as something other than a plain link.
   *
   * Collections becomes the MegaMenu and Home is represented by the logo on
   * desktop, so both were filtered out of the link list — and the MegaMenu
   * and the mobile Home link were then hardcoded. The result: those two rows
   * had a visibility switch, a label field and reorder buttons in the admin,
   * and none of them changed anything a customer saw. `navItems` already
   * contains only VISIBLE rows, so finding one is the visibility test.
   */
  const collectionsRow = navItems.find((item) => item.href === routes.store.collections);
  const homeRow = navItems.find((item) => item.href === routes.store.home);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<"phone" | "signup">("phone");

  useEffect(() => {
    // Store name / logo / nav / search come from the server chrome prop above;
    // only the client-only cart, wishlist and customer session are read here.
    setCartCount(getCartItemCount());
    setWishlistCount(getWishlistCount());
    setSignedIn(hasCustomerSession());
    setCustomerName(getCustomerDisplayName());
    setCustomerPhone(getCustomerSession()?.phone ?? "");
  }, []);

  useEffect(() => {
    const refreshCounts = () => {
      setCartCount(getCartItemCount());
      setWishlistCount(getWishlistCount());
      setSignedIn(hasCustomerSession());
      setCustomerName(getCustomerDisplayName());
      setCustomerPhone(getCustomerSession()?.phone ?? "");
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

  // Any page can request the login modal via openCustomerAuthModal().
  useEffect(() => {
    const onOpen = (event: Event) => {
      const step = (event as CustomEvent<{ step?: "phone" | "signup" }>).detail?.step ?? "phone";
      setAuthStep(step);
      setAuthOpen(true);
    };
    window.addEventListener(OPEN_AUTH_MODAL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_AUTH_MODAL_EVENT, onOpen);
  }, []);

  // Protected pages redirect here with ?login=1 when there's no session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "1") {
      setAuthStep("phone");
      setAuthOpen(true);
      params.delete("login");
      const query = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
    }
  }, [pathname]);

  const accountHref = signedIn ? routes.account.dashboard : routes.store.home;

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
    <>
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-white transition-colors",
        scrolled ? "border-border" : "border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={routes.store.home} className="flex items-center gap-2.5">
          {logo && !logoBroken ? (
            // An admin-typed URL on any host, so next/image is not usable here:
            // it would need every such host allow-listed in next.config
            // remotePatterns, and an un-listed one throws instead of rendering.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={siteName}
              onError={() => setLogoBroken(true)}
              // The logo is in the SERVER-rendered HTML, so a 404 can resolve
              // before the bundle has even downloaded — and React does not
              // replay load/error events that completed before hydration. The
              // handler above would never fire and the header would keep a
              // broken-image glyph forever. This asks the element directly.
              ref={(node) => {
                if (node?.complete && node.naturalWidth === 0) setLogoBroken(true);
              }}
              className="size-9 rounded-xl object-contain shadow-sm"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-xl bg-bakery-700 shadow-sm">
              <span className="font-heading text-sm font-bold text-white">
                {logoLetter}
              </span>
            </div>
          )}
          <span className="font-heading text-lg font-bold tracking-tight text-foreground">
            {siteName}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {collectionsRow ? (
            <MegaMenu
              label={collectionsRow.label}
              isActive={
                pathname === routes.store.collections ||
                pathname.startsWith(`${routes.store.collections}/`)
              }
            />
          ) : null}
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
                data-gate-wedding={item.href === routes.store.weddingCakes ? "" : undefined}
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

        <div className="flex items-center gap-1 sm:gap-1.5">
          {/*
            The header CTA the admin has always been able to configure.
            Its switch, label and link were stored, validated and shown in a
            summary line — and rendered nowhere, so setting them changed
            nothing a customer ever saw.
          */}
          {cta.show ? (
            <Button
              variant="bakery"
              size="sm"
              className="hidden lg:inline-flex"
              render={<Link href={cta.href} />}
            >
              {cta.label}
            </Button>
          ) : null}
          {showSearch ? (
            <Button
              variant="ghost"
              size="icon-lg"
              className="hidden text-foreground hover:bg-cream-100 hover:text-bakery-700 sm:flex"
              render={<Link href={routes.store.search} aria-label="Search" />}
            >
              <Search className="size-5" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-lg"
            className="relative hidden text-foreground hover:bg-cream-100 hover:text-bakery-700 sm:flex"
            render={<Link href={routes.store.wishlist} aria-label="Wishlist" />}
          >
            <Heart className="size-5" />
            {wishlistCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bakery-700 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {wishlistCount > 9 ? "9+" : wishlistCount}
              </span>
            ) : null}
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            className="relative text-foreground hover:bg-cream-100 hover:text-bakery-700"
            render={<Link href={routes.store.cart} aria-label="Shopping cart" />}
          >
            <ShoppingBag className="size-5" />
            {cartCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bakery-700 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            ) : null}
          </Button>
          {signedIn ? (
            <div className="ml-1 hidden sm:flex">
              <AccountMenu
                name={customerName}
                phone={customerPhone}
                onSignOut={() => {
                  setSignedIn(false);
                  setCustomerName("");
                  setCustomerPhone("");
                }}
              />
            </div>
          ) : (
            <div className="ml-0.5 hidden sm:flex">
              <GuestMenu />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon-lg"
            className="ml-0.5 text-foreground hover:bg-cream-100 hover:text-bakery-700 lg:hidden"
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
            {homeRow ? (
              <Link
                href={homeRow.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm font-medium",
                  pathname === routes.store.home
                    ? "bg-cream-100 text-bakery-700"
                    : "hover:bg-cream-100"
                )}
              >
                {homeRow.label}
              </Link>
            ) : null}
            {collectionsRow ? (
              <MobileShopLinks
                label={collectionsRow.label}
                onNavigate={() => setMobileOpen(false)}
              />
            ) : null}
            {navItems
              .filter((item) => item.href !== routes.store.collections && item.href !== routes.store.home)
              .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  data-gate-wedding={item.href === routes.store.weddingCakes ? "" : undefined}
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
              {signedIn ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={accountHref} onClick={() => setMobileOpen(false)} />}
                >
                  <User className="size-4" />
                  Account
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMobileOpen(false);
                    setAuthStep("phone");
                    setAuthOpen(true);
                  }}
                >
                  <User className="size-4" />
                  Account
                </Button>
              )}
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
          </nav>
        </div>
      ) : null}
    </header>
    <CustomerAuthModal
      open={authOpen}
      onOpenChange={setAuthOpen}
      initialStep={authStep}
      onAuthenticated={() => {
        setSignedIn(true);
        setCustomerName(getCustomerDisplayName());
      }}
    />
    </>
  );
}
