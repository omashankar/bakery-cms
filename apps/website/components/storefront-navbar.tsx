"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { navIcon } from "@/config/nav-icons";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/brand-mark";
import { DeliveryLocationButton } from "./delivery-location-button";
import {
  drawableGroups,
  MegaMenu,
  MobileShopLinks,
} from "@/components/storefront/mega-menu";
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
  syncCustomerSession,
} from "@/apps/website/account/lib/customer-session";
import type { StorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";
import { useBusinessLabels } from "@/hooks/use-business-labels";
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
  const [logoLetter] = useState(chrome.logoLetter);
  const [navItems] = useState(chrome.navItems);
  const [utilityNav] = useState(chrome.utilityNav);
  const [currencyNote] = useState(chrome.currencyNote);
  const labels = useBusinessLabels();
  const [showSearch] = useState(chrome.showSearch);
  const [searchPlaceholder] = useState(chrome.searchPlaceholder);
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
  /**
   * THE ROWS THE BAND DRAWS, in the order the shop set.
   *
   * Collections is in here. It used to be rendered before the map and
   * filtered out of it, which pinned it to the head of the band whatever the
   * admin's reorder arrows said — so a shop that wanted its promoted row
   * first could not have it, and the control that promised otherwise did
   * nothing. Home is not: on desktop the logo is the way home.
   */
  const bandRows = navItems.filter((item) => item.href !== routes.store.home);
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

    /**
     * Ask the SERVER who is signed in.
     *
     * The header renders from the cached copy first so the account menu does
     * not flash "Login" on every page, then corrects it here. This is what
     * makes an expired session, a sign-out in another tab, or an account the
     * shop has blocked actually take effect — the cache alone would keep an
     * account menu, and a name, on screen indefinitely.
     *
     * `syncCustomerSession` dispatches the session event, which the listener
     * below picks up, so there is nothing to set from here.
     */
    void syncCustomerSession();
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
        /*
          A SHADOW ON SCROLL, not a border.

          The band below owns a hairline of its own now — the reference has
          one above it and one below — and the header's border sat on the
          same edge, so the two stacked into a 2px line the moment anybody
          scrolled. A shadow says the same thing (the header is floating over
          the page) without competing for that pixel.
        */
        "sticky top-0 z-50 w-full bg-white transition-shadow",
        scrolled && "shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      )}
    >
      {/*
        THE UTILITY ROW.

        Right-aligned, quiet, and hidden on phones — it is the row a customer
        goes looking for rather than reads. Renders NOTHING when the shop has
        written no links and asked for no currency note, which is every shop
        until somebody opens the Header screen.
      */}
      {utilityNav.length > 0 || currencyNote ? (
        <div className="hidden border-b border-border/60 bg-cream-50/40 lg:block">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-0 px-4 py-1.5 text-xs text-muted-foreground sm:px-6 lg:px-8">
            {currencyNote ? (
              <>
                {/*
                  A READOUT. Currency is one shop-wide setting published into
                  a process-global locale and the gateway takes rupees only,
                  so a control that looked like a switcher would charge in INR
                  regardless. Saying which currency the prices are in is true.
                */}
                <span className="px-3">
                  Currency · <span className="font-medium text-foreground">{currencyNote}</span>
                </span>
                {utilityNav.length > 0 ? (
                  <span className="h-3 w-px bg-border" aria-hidden="true" />
                ) : null}
              </>
            ) : null}
            {utilityNav.map((item, index) => (
              <span key={item.id} className="flex items-center">
                {index > 0 ? (
                  <span className="h-3 w-px bg-border" aria-hidden="true" />
                ) : null}
                <Link
                  href={item.href}
                  className="px-3 transition-premium hover:text-bakery-700"
                >
                  {item.label}
                </Link>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/*
        `data-header-bar` is read by a test, and that is its whole job.

        The guard that proves the category strip sits BELOW this row used to
        find it by the literal string `mx-auto flex h-16 max-w-7xl` — so the
        row's height and its container width were pinned by a test about
        neither, and any restyle reddened a guard that had nothing to say
        about the change. A marker moves with the element it marks.
      */}
      <div
        data-header-bar
        /*
          Taller from lg, where the reference row is about 90px and there is
          room for it. Appended rather than written in place of `h-16`: the
          base height is what a phone gets, and the two survive together
          because they are different breakpoints.
        */
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:h-[88px] lg:gap-4 lg:px-8"
      >
        {/*
          `min-w-0` and a cap on the phone, because the shop's name is free
          text of any length and this is the flex child that grows. A long
          one pushed the cart and the menu button off the row entirely.
        */}
        <Link
          href={routes.store.home}
          className="flex min-w-0 max-w-[9rem] shrink-0 items-center gap-2.5 sm:max-w-[12rem] lg:max-w-none"
        >
          <BrandMark logo={logo} logoLetter={logoLetter} siteName={siteName} />
        </Link>


        {/*
          WHERE THE ORDER IS GOING, beside the search.

          Mounted only when the shop has an active delivery zone — with none,
          the only answer the panel could give is that nothing covers you,
          which is a claim about the shop rather than a fact about its zone
          list. Hidden below sm, where the row has no width for it and the
          same check is a tap away in the drawer.
        */}
        {chrome.hasDeliveryZones ? (
          <div className="ml-auto hidden sm:block lg:ml-3 lg:shrink-0">
            <DeliveryLocationButton />
          </div>
        ) : null}

        {/*
          THE SEARCH BOX.

          It was an icon that linked to /store/search — a whole navigation
          away from the control the reference header puts in front of every
          visitor. A plain form, so it works before hydration and with
          JavaScript off: the search page already reads `q` from the query
          string, which is what makes this a GET to the page that exists
          rather than a second search implementation.

          The icon below stays for phones, where there is no room for a box.
        */}
        {showSearch ? (
          <form
            action={routes.store.search}
            /*
              FROM sm, NOT FROM lg.

              Between 640 and 1023px there is easily room for a search box,
              and what stood there was an icon linking to a separate page —
              a whole navigation away from the control the reference header
              puts in front of every visitor. That band is every tablet and
              every phone held sideways.

              `min-w-0` because a flex child will not shrink below its
              content without it, and this one sits between a shop name of
              unknown length and an icon cluster.
            */
            className="mx-3 hidden min-w-0 max-w-xl flex-1 items-center sm:flex lg:mx-6"
            role="search"
          >
            <div className="relative w-full">
              <input
                type="search"
                name="q"
                placeholder={
                  searchPlaceholder ||
                  `Search ${labels.productWordPlural.toLowerCase()}…`
                }
                aria-label="Search"
                className="h-10 w-full rounded-full border border-input bg-cream-50 pl-4 pr-11 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <button
                type="submit"
                aria-label="Search"
                className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-cream-100 hover:text-bakery-700"
              >
                <Search className="size-4" />
              </button>
            </div>
          </form>
        ) : null}

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
              /*
                Phones only, which this comment claimed and the classes
                contradicted: `hidden … sm:flex lg:hidden` HID the icon below
                640px and showed it on tablets, so a phone got no search
                control in the header at all while the file documented the
                opposite. Now that the box starts at sm, phones-only is both
                what it says and what it does.
              */
              className="flex text-foreground hover:bg-cream-100 hover:text-bakery-700 sm:hidden"
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

      {/*
        THE NAV, IN ITS OWN BAND.

        It rendered inline inside the 64px main bar, beside the logo and the
        icon cluster — which fits four rows and not eleven plus a promoted
        item. The reference header puts the categories on their own full-width
        strip under the logo row, and that layout is what makes the whole list
        fit at all, so the per-row emphasis added alongside it is worth
        anything.

        Hidden on a phone, where the same rows are in the drawer.
      */}
      {/* `data-nav-band` for the same reason `data-header-bar` exists: the
          guard below cares that this band is hidden on a phone, not what
          colour it is. */}
      {/*
        NOTHING TO SHOW MEANS NO BAND.

        A shop that switches every nav row off still got the strip: a
        hairline, 12px of padding and nothing between them, under the main
        bar of every desktop page. Invisible while the fill was white on
        white; a grey bar of nothing the moment the fill became real.
      */}
      {bandRows.length > 0 ? (
      <div
        data-nav-band
        /*
          cream-100, NOT cream-50.

          `--cream-50` is literally `#ffffff` — in globals.css and, for every
          shop palette, in appearance-tokens — so `bg-cream-50/60` over a
          white header painted white at 60% opacity onto white. The band the
          comment below describes was, to a customer, not there at all.
          `--cream-100` is the shop's own surface colour, so the tint tracks
          whatever palette the shop picked instead of being a fixed grey.

          A hairline above AND below, which is what closes it as a band. The
          header's own border moved to a shadow so they do not stack.
        */
        className="hidden border-y border-border bg-cream-100 lg:block"
      >
        <nav
          className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-1.5 sm:px-6 lg:px-8"
          aria-label="Shop categories"
        >
        {bandRows.map((item, index) => {
          const isActive =
            pathname === item.href ||
            (item.href !== routes.store.home && pathname.startsWith(item.href));
          /**
           * WHICH EDGE THE PANEL HANGS FROM.
           *
           * The panel is 640px and the band's content column is 960px at lg,
           * so a trigger in the second half of the row pushed a left-anchored
           * panel past the window and gave the storefront a horizontal
           * scrollbar. Decided from position rather than measured, because
           * measuring means reading layout during render.
           */
          const align = index >= Math.floor(bandRows.length / 2) ? "right" : "left";
          const divider = item.dividerBefore && index > 0 ? (
            /* A divider before the FIRST row separates it from nothing. */
            <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          ) : null;

          /*
            The taxonomy menu is a row in this list now, so its place in the
            band is its own sortOrder. A shop that has written its own groups
            for this row gets those instead, exactly as any other row does.
          */
          if (item.href === routes.store.collections && drawableGroups(item.menu).length === 0) {
            return (
              <div key={item.id} className="flex items-center gap-1">
                {divider}
                <MegaMenu
                  label={item.label}
                  href={item.href}
                  categories={chrome.categories}
                  occasions={chrome.occasions}
                  isActive={isActive}
                  highlight={item.highlight}
                  icon={item.icon}
                  badge={item.badge}
                  align={align}
                />
              </div>
            );
          }
          /**
           * A ROW WITH ITS OWN MENU IS A MENU, NOT A LINK.
           *
           * Only the Collections row could have a mega menu, and its two
           * columns were headed in the component. A shop wanting CAKES with
           * "By Flavour" and "By Theme" beside GIFTS with its own columns
           * had nowhere to put that. Any row can carry one now; a row with
           * none stays exactly the plain link it was.
           */
          const authored = drawableGroups(item.menu);
          if (authored.length > 0) {
            return (
              <div key={item.id} className="flex items-center gap-1">
                {divider}
                {/*
                  The four promoted fields travel now. They stopped at the
                  plain-link branch, so a shop that gave its highlighted row a
                  dropdown lost the highlight, the icon and the badge with no
                  warning anywhere — and the divider, which the type says is a
                  property of the ROW precisely so that it travels with it.
                */}
                <MegaMenu
                  label={item.label}
                  href={item.href}
                  groups={item.menu}
                  isActive={isActive}
                  highlight={item.highlight}
                  icon={item.icon}
                  badge={item.badge}
                  align={align}
                />
              </div>
            );
          }
          const RowIcon = navIcon(item.icon);
          return (
            /*
              THE GATE IS ON THE WRAPPER, not on the link inside it.

              `[data-gate-wedding]` is hidden with display:none for a shop
              whose wedding module is off. On the Link alone that hid the link
              and left its divider behind: a 20px hairline floating in the
              band with nothing after it.
            */
            <div
              key={item.id}
              className="flex items-center gap-1"
              data-gate-wedding={item.href === routes.store.weddingCakes ? "" : undefined}
            >
              {divider}
              <Link
                href={item.href}
                className={cn(
                  /*
                    UPPERCASE, letter-spaced and a size smaller — the
                    reference's category strip, and what makes eleven rows
                    plus a promoted item fit across the band at all. The
                    transform is CSS: the stored label is still exactly what
                    the shop typed.
                  */
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] transition-premium",
                  // The shop's emphasis beats the route's. A promoted row
                  // reads as promoted whether or not you are standing on it —
                  // and it is bolder as well as brand-coloured, because eleven
                  // neighbours at the same weight swallow a colour change.
                  item.highlight
                    ? "font-semibold text-bakery-700 hover:bg-cream-200"
                    : isActive
                      ? "bg-cream-200 text-bakery-700"
                      : "text-muted-foreground hover:bg-cream-200 hover:text-foreground"
                )}
              >
                {RowIcon ? <RowIcon className="size-4" /> : null}
                {item.label}
                {item.badge ? (
                  <span className="rounded-full bg-bakery-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-bakery-700">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </div>
          );
        })}
        </nav>
      </div>
      ) : null}
      {mobileOpen ? (
        <div
          id="storefront-mobile-nav"
          /*
            A CEILING, AND ITS OWN SCROLL.

            The drawer is plain in-flow content and `useBodyScrollLock` sets
            `overflow: hidden` on the body while it is open — so anything
            past the fold could not be reached at all. With this shop's seven
            nav rows it already ran past a 667px phone, which put the
            wishlist/cart/account row, and the only way to sign in on a
            phone, below a fold nobody could scroll to.

            `dvh` rather than `vh` because mobile browser chrome collapses on
            scroll, and `overscroll-contain` so the locked body does not
            swallow the drawer's own scroll at its ends.
          */
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-border bg-white lg:hidden"
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
                categories={chrome.categories}
                occasions={chrome.occasions}
                onNavigate={() => setMobileOpen(false)}
              />
            ) : null}
            {navItems
              .filter((item) => item.href !== routes.store.collections && item.href !== routes.store.home)
              .map((item, index) => {
                /*
                  The phone gets the same groups, for the reason this repo
                  keeps relearning: a menu that differs by screen size is two
                  menus, and the phone is the one an Indian shop's customers
                  actually use.
                */
                if (drawableGroups(item.menu).length > 0) {
                  return (
                    <MobileShopLinks
                      key={item.id}
                      label={item.label}
                      groups={item.menu}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  );
                }
              const isActive = pathname === item.href;
              // Same four, on the phone. A header that differs by screen size
              // is two headers, and this is the one a customer uses.
              const RowIcon = navIcon(item.icon);
              return (
                /* The gate sits on the wrapper here too, so a row hidden for
                   a shop with no wedding module takes its rule with it. */
                <div
                  key={item.id}
                  data-gate-wedding={item.href === routes.store.weddingCakes ? "" : undefined}
                >
                  {item.dividerBefore && index > 0 ? (
                    <div className="my-2 h-px bg-border" aria-hidden="true" />
                  ) : null}
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                      item.highlight
                        ? "font-semibold text-bakery-700 hover:bg-cream-100"
                        : isActive
                          ? "bg-cream-100 text-bakery-700"
                          : "hover:bg-cream-100"
                    )}
                  >
                    {RowIcon ? <RowIcon className="size-4" /> : null}
                    {item.label}
                    {item.badge ? (
                      <span className="rounded-full bg-bakery-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bakery-700">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </div>
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

            {/*
              THE UTILITY ROW, WHICH THE PHONE COULD NOT REACH AT ALL.

              Its own band is `hidden … lg:block`, and nothing else rendered
              it — so Track Order, Help, and whatever else a shop puts up
              there existed only on a desktop. Those are exactly the rows a
              customer goes looking for, and this shop's customers are on
              phones.
            */}
            {utilityNav.length > 0 || currencyNote ? (
              <div className="mt-2 space-y-1 border-t border-border pt-3">
                {utilityNav.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-cream-100 hover:text-bakery-700"
                  >
                    {item.label}
                  </Link>
                ))}
                {currencyNote ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    Currency ·{" "}
                    <span className="font-medium text-foreground">{currencyNote}</span>
                  </p>
                ) : null}
              </div>
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
