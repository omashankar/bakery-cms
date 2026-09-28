"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
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
import { layoutSpacing } from "@/constants/spacing";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  MIN_SUGGEST_CHARS,
  type ProductSuggestion,
} from "@/features/products/lib/product-suggestions";
import { cn } from "@/lib/utils";

/**
 * HOW FAR THE PAGE MOVES BEFORE THE BAND ANSWERS AT ALL.
 *
 * At lg the header is an 88px bar with a 46px category band under it, and
 * about 28px more when the shop has written a utility row — so 200 is past
 * the whole of it either way. Under that the customer is still looking at
 * the top of the page, and a band that leaves while they are still at the
 * top reads as something breaking rather than as room being made.
 */
const BAND_HOLDS_UNTIL = 200;

/**
 * HOW FAR A SCROLL HAS TO TURN BACK BEFORE THE BAND ANSWERS IT.
 *
 * Measured from the turning point, not from the last frame, so a customer
 * 900px down who jitters a pixel each way has travelled one pixel and
 * nothing moves. 48 is under a wheel notch, so a deliberate flick upwards
 * still brings the band back at once.
 *
 * It is deliberately MORE than the band's own 46px. Taking the band away
 * makes the document 46px shorter, and the browser answers that by moving
 * the scroll position itself — clamping at the foot of the page, and scroll
 * anchoring everywhere else. That is the page moving, not the customer, and
 * on its own it can never cross this number. The settling tick in the
 * handler is the other half of that guard, and the deterministic half.
 */
const BAND_ANSWERS_AFTER = 48;

/**
 * HOW LONG THE BAND TAKES TO GO, AND THE CLIP THAT TRAVELS WITH IT.
 *
 * The band's height is what animates — that is the whole point, because the
 * 46px it gives back is what the page below moves by, and a page that jumps
 * 46px is what the shop was looking at before this. Animating a height needs
 * `overflow: hidden`, or the rows inside spill out of a box that is no longer
 * tall enough to hold them.
 *
 * And `overflow: hidden` on this element CLIPS THE MEGA-MENU PANEL, which is
 * 640px, hangs below the band by design, and is a DOM descendant of it. So the
 * clip is not a permanent class: it is switched on for the length of the
 * slide and off again. Safe to do, because the band refuses to move at all
 * while the pointer is inside it — so no panel can be open when the clip
 * goes on.
 *
 * A TIMER RATHER THAN `transitionend`. Under `prefers-reduced-motion` there
 * is no transition, so no event ever fires, and the clip would stay on for
 * the rest of the session with every dropdown cut off at the band's edge.
 * A timer always fires; 60ms past the duration covers a late frame.
 */
const BAND_SLIDE_MS = 200;
const BAND_CLIP_MS = BAND_SLIDE_MS + 60;

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

  /* ------------------------------------------------------------------ *
   * THE SEARCH BOX ANSWERS WHILE THE CUSTOMER IS STILL TYPING.
   *
   * It submitted, and that was all it did: type, press Enter, wait for a
   * page. Every shop these customers already use answers before the Enter,
   * and the reason is not decoration — somebody who types three letters and
   * sees the thing they came for goes straight to it, and somebody who sees
   * nothing types two more letters and guesses again.
   *
   * THE FORM STILL WORKS EXACTLY AS IT DID. This is added on top of a native
   * GET, never in place of it: Enter with nothing highlighted submits the
   * form and lands on the results page, which is what happens with
   * JavaScript off, before hydration, and for anyone who ignores the
   * dropdown entirely. Only Enter with a row highlighted is intercepted.
   * ------------------------------------------------------------------ */
  const pathname = usePathname();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  /** -1 is "nothing highlighted", which is the state Enter must submit in. */
  const [activeRow, setActiveRow] = useState(-1);
  /** Phones have no room for the box, so the icon reveals one. */
  const [phoneSearchOpen, setPhoneSearchOpen] = useState(false);
  const searchFormRef = useRef<HTMLFormElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  /**
   * Answers already paid for, for this page's lifetime only.
   *
   * Backspacing is most of what typing in a search box is, and without this
   * every deleted character is a fresh request for an answer the browser had
   * a moment ago. Deliberately NOT a cache header on the endpoint: a shop
   * that unpublishes a product should stop suggesting it on the next page
   * load, not when a CDN decides to let go.
   */
  const suggestCache = useRef(new Map<string, ProductSuggestion[]>());
  const suggestListId = useId();

  /*
    180ms, not the hook's default 300.

    A dropdown is read between keystrokes, so the delay is felt directly in a
    way an admin list filter is not — 300 reads as the box thinking about it.
    It is still long enough that "chocolate" costs one request rather than
    nine, which is the whole reason the debounce is here.
  */
  const debouncedTerm = useDebouncedValue(term, 180);

  /**
   * NEW ROWS ARRIVE WITH NOTHING HIGHLIGHTED, always, in one render.
   *
   * This was an effect on `[suggestions]` that reset the highlight afterwards,
   * and "afterwards" is the whole problem: between the rows changing and the
   * effect running there is a render in which `activeRow` still points into
   * the list that has just been replaced. A customer who has walked down to
   * row four and then types one more letter is, for that render, highlighting
   * whichever product has landed in position four of a different list — and
   * Enter opens it.
   *
   * Setting both together makes that window impossible rather than short, and
   * costs one render instead of two on every keystroke.
   */
  const showSuggestions = (rows: ProductSuggestion[]) => {
    setSuggestions(rows);
    setActiveRow(-1);
  };

  useEffect(() => {
    const query = debouncedTerm.trim();
    if (query.length < MIN_SUGGEST_CHARS) {
      showSuggestions([]);
      return;
    }

    const key = query.toLowerCase();
    const remembered = suggestCache.current.get(key);
    if (remembered) {
      showSuggestions(remembered);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/products/suggest?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then((answer) => (answer.ok ? answer.json() : null))
      .then((body: { data?: unknown } | null) => {
        const rows = Array.isArray(body?.data) ? (body.data as ProductSuggestion[]) : [];
        suggestCache.current.set(key, rows);
        showSuggestions(rows);
      })
      .catch((error: unknown) => {
        /*
          A KEYSTROKE ABORTS THE LAST REQUEST, which is not a failure and must
          not clear anything — the rows on screen belong to what is still in
          the box. A real failure must clear, though, because the alternative
          is the previous query's products sitting under a different word.
        */
        if ((error as { name?: string })?.name === "AbortError") return;
        showSuggestions([]);
      });

    return () => controller.abort();
  }, [debouncedTerm]);

  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (event: Event) => {
      if (!searchFormRef.current?.contains(event.target as Node)) setPanelOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [panelOpen]);

  useEffect(() => {
    setPanelOpen(false);
    setPhoneSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (phoneSearchOpen) searchInputRef.current?.focus();
  }, [phoneSearchOpen]);

  /**
   * THE BOX SHOWS WHAT WAS SEARCHED FOR, on the page the search landed on.
   *
   * It did not. A customer searched "butterscotch", arrived at a results page
   * saying "Showing 3 of 27 for butterscotch", and found the header box empty
   * above it — so refining the search meant typing the whole word again.
   *
   * Seeded through the updater rather than assigned, and that is not a style
   * choice: this runs after hydration, and anything already typed into the
   * box before then — by a fast customer or by a test — would otherwise be
   * thrown away by a stale query string.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const searched = new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
    if (!searched) return;
    setTerm((typed) => (typed ? typed : searched));
  }, [pathname]);

  const openSuggestion = (row: ProductSuggestion) => {
    setPanelOpen(false);
    setPhoneSearchOpen(false);
    router.push(routes.store.cake(row.slug));
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      /*
        PREVENTED, AND THE REASON IS THE BROWSER, NOT THIS CODE.

        `type="search"` is not a plain text box: Chrome and Safari EMPTY it
        when Escape is pressed. So dismissing the suggestions also threw away
        what the customer had typed — they pressed Escape to get the list off
        the screen and lost the word they were halfway through. Measured, not
        reasoned about: the probe pressed Escape and then Enter, and the form
        submitted `?q=` with nothing in it.

        The field stays `type="search"` deliberately — it is what puts the
        clear button in the box and what a phone keyboard reads to draw a
        Search key instead of Return.
      */
      event.preventDefault();
      setPanelOpen(false);
      setActiveRow(-1);
      return;
    }
    if (event.key === "Enter") {
      // ONLY when a row is highlighted. Otherwise the form submits, which is
      // the behaviour everything else in this box depends on.
      const picked = panelOpen && activeRow >= 0 ? suggestions[activeRow] : undefined;
      if (!picked) return;
      event.preventDefault();
      openSuggestion(picked);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (suggestions.length === 0) return;

    // Prevented so the caret does not jump to either end of the box while
    // the customer is walking the list.
    event.preventDefault();
    setPanelOpen(true);
    setActiveRow((current) => {
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = current + step;
      // Past the last row comes "nothing highlighted", not the first row:
      // Enter there submits the search, which is where a customer walking
      // off the end of six suggestions is trying to get to.
      if (next >= suggestions.length) return -1;
      if (next < -1) return suggestions.length - 1;
      return next;
    });
  };

  const suggestionsShowing = panelOpen && suggestions.length > 0;

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
  const [scrolled, setScrolled] = useState(false);
  /*
    THE HANDLES THE SCROLL EFFECT WRITES THROUGH.

    `scrolledRef` mirrors the state above so the effect can tell a real flip
    from a repeat without naming `scrolled` as a dependency — which would
    tear the listener down, and forget where the customer had scrolled to,
    every time the shadow turned over.
  */
  const navBandRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);
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

  /*
    A COLLAPSED BAND IS OUT OF THE TAB ORDER, so focus arriving anywhere in
    the header brings it back. Without this a keyboard customer who has
    scrolled cannot reach the categories at all — the rows are display:none
    and there is nothing to tab to.

    Named, not an arrow written inline on the element: `=>` in the header's
    opening tag truncates the slice `the-nav-band-is-a-band.test.ts` reads
    up to the first `>`, and that test would fail on correct code.
  */
  const showBand = () => {
    if (navBandRef.current) navBandRef.current.dataset.collapsed = "false";
  };

  /**
   * THE BAND GOES UP WHEN THE PAGE GOES DOWN. THE BAR DOES NOT MOVE.
   *
   * 134px of a 900px window is a lot of header to keep pinned over a page
   * four and a half thousand pixels long, so the category band steps out of
   * the way while the customer is reading and comes back the moment they
   * scroll up. The bar with the logo, the search and the cart stays where it
   * is throughout — that is the half of this header a customer would miss.
   *
   * DIRECTION, not depth. A customer who has stopped to read has not asked
   * for anything to move, and a band that came back at a fixed offset would
   * appear and disappear at the same place every time they passed it.
   *
   * NOTHING HERE IS REACT STATE. The band is hidden by a `data-collapsed`
   * attribute written straight onto the node, so scrolling this page end to
   * end re-renders this component exactly as often as it did before: when
   * the shadow turns over, and not otherwise. That matters — the component
   * is twelve hundred lines and draws up to eleven menu subtrees.
   */
  useEffect(() => {
    let frame = 0;
    /** The turning point a reversal is measured from. */
    let anchor = Math.max(0, window.scrollY);
    let collapsed = false;
    /** The tick after a change belongs to the change — see the constant. */
    let settling = false;
    /** The clip that is on while the band is in motion, and off otherwise. */
    let clip = 0;

    // A new page starts with the band open, whatever the last one ended on.
    if (navBandRef.current) navBandRef.current.dataset.collapsed = "false";

    const setCollapsed = (next: boolean) => {
      const band = navBandRef.current;
      if (!band || next === collapsed) return;
      collapsed = next;
      settling = true;
      band.dataset.collapsed = next ? "true" : "false";

      // The clip travels with the slide, in both directions — see the constant.
      band.dataset.animating = "true";
      if (clip) clearTimeout(clip);
      clip = window.setTimeout(() => {
        clip = 0;
        band.dataset.animating = "false";
      }, BAND_CLIP_MS);
    };

    const settle = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);

      /*
        The shadow, which is the only thing here that is state — and the only
        edge left under the bar once the band's hairline has gone.
      */
      const wantsShadow = y > 8;
      if (wantsShadow !== scrolledRef.current) {
        scrolledRef.current = wantsShadow;
        setScrolled(wantsShadow);
      }

      const band = navBandRef.current;
      if (!band) return;

      if (settling) {
        /*
          The page just changed height and the browser moved the scroll
          position to match. That is not the customer scrolling.
        */
        settling = false;
        anchor = y;
        return;
      }

      // At the top of the page the band is simply there.
      if (y <= BAND_HOLDS_UNTIL) {
        anchor = y;
        setCollapsed(false);
        return;
      }

      /*
        AN OPEN MENU, OR A KEYBOARD INSIDE THE BAND, HOLDS IT OPEN.

        The panel is `absolute` but it is still a DOM descendant of the band,
        and :hover matches an ancestor of whatever the pointer is over — so
        this one test covers a pointer anywhere in an open 640px panel.
        Without it, wheeling over a panel deletes it from under the pointer.

        :focus-within is the same question for a keyboard. Hiding an element
        that contains the focused link drops focus to the body.
      */
      if (band.matches(":hover") || band.matches(":focus-within")) {
        anchor = y;
        return;
      }

      // Still going the way it was going: move the turning point with it.
      if (collapsed ? y > anchor : y < anchor) {
        anchor = y;
        return;
      }

      if (Math.abs(y - anchor) < BAND_ANSWERS_AFTER) return;
      anchor = y;
      setCollapsed(!collapsed);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(settle);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      /*
        Left running, this fires against a node from the page that has gone
        and leaves the next page's band clipped.
      */
      if (clip) clearTimeout(clip);
    };
  }, [pathname]);

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
      onFocus={showBand}
      className={cn(
        /*
          A SHADOW ON SCROLL, not a border.

          The band below owns a hairline of its own now — the reference has
          one above it and one below — and the header's border sat on the
          same edge, so the two stacked into a 2px line the moment anybody
          scrolled. A shadow says the same thing (the header is floating over
          the page) without competing for that pixel.
        */
        "sticky top-0 z-50 w-full bg-background transition-shadow",
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
          {/* The same column as everything below it — see layoutSpacing. */}
          <div
            className={cn(
              layoutSpacing.container,
              "flex items-center justify-end gap-0 py-1.5 text-xs text-muted-foreground"
            )}
          >
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
        className={cn(
          layoutSpacing.container,
          /*
            Taller from lg, where the reference row is about 90px and there is
            room for it. The base height is what a phone gets; the two survive
            together because they are different breakpoints.
          */
          /*
            `relative` so the phone's search band has something to hang from.
            It is the row the band drops out of, and `top-full` measures from
            the nearest positioned ancestor — without this that is the sticky
            header itself on some pages and the page box on others, which put
            the band over the row on one and halfway down the hero on another.
          */
          "relative flex h-16 items-center justify-between gap-2 lg:h-[88px] lg:gap-4"
        )}
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
          list.

          FROM lg, AND IT USED TO SAY sm. The note here claimed the same
          check was 'a tap away in the drawer', and it was not — nothing
          rendered it there, so below 640 a customer had no way to ask
          whether the shop delivers to them at all. It is in the drawer now,
          which is what makes this line safe to move.

          It moved because the row could not hold everything. At 640 this
          pill is 183px of a 592px row, and the search box beside it was
          being squeezed to ZERO — its 24px of margin was all that was left
          of it — while the row still overran the window by 2px and gave the
          whole page a sideways scrollbar. Measured at 640 and 641, nowhere
          else.
        */}
        {chrome.hasDeliveryZones ? (
          <div className="ml-auto hidden lg:ml-3 lg:block lg:shrink-0">
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
            action={routes.store.collections}
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
            className={cn(
              "mx-3 min-w-0 max-w-2xl flex-1 items-center sm:flex lg:mx-6",
              /*
                AND ON A PHONE IT IS A BAND UNDER THE ROW, not a box in it.

                Below 640 the row holds a logo, a cart and a menu button and
                genuinely has no width left — that is why there is an icon
                there instead. But the icon used to be a LINK to the
                collections page, so a phone customer tapping the one search
                control in the header got an unfiltered grid and no box to
                type in: the control named Search could not search.

                So the same form drops below the row when the icon is tapped.
                One form, not two — the alternative was a second <form> with
                a second input and a second copy of every keyboard handler,
                and the two would drift the way the two search haystacks did.
              */
              phoneSearchOpen
                ? "absolute inset-x-0 top-full z-40 mx-0 flex max-w-none border-b border-border bg-card px-4 py-2.5 sm:static sm:mx-3 sm:max-w-2xl sm:border-0 sm:bg-transparent sm:p-0 lg:mx-6"
                : "hidden",
            )}
            ref={searchFormRef}
            role="search"
          >
            {/*
              THE MAGNIFIER SITS ON THE LEFT, AND IS STILL THE SUBMIT.

              It was a round pill with the icon on the right, which reads as
              a button with a text field bolted to it. Every shop a customer
              already uses puts the glass first, ahead of the words, so the
              icon is the label for the box rather than the control at the
              end of it — and this is the shape the shop asked for.

              Keeping it a `type="submit"` rather than dropping in a plain
              <Search /> is the part that is easy to lose: it is the only
              way to run a search with a pointer, and the only one at all
              before the page hydrates or with JavaScript off. Decorative on
              the left would take that away from every one of those.
            */}
            <div className="relative w-full">
              <button
                type="submit"
                aria-label="Search"
                /*
                  AN EMPTY BOX MEANS "PUT THE CURSOR HERE", NOT "SEARCH FOR
                  NOTHING".

                  The shop reported this: clicking the magnifier still landed
                  on the collections page. It did — the button submits, and a
                  submit with an empty field is a GET to
                  `/store/collections?q=`, which is the unfiltered grid. So the
                  one control that looks most like "search" was the last one
                  still behaving like the link this work set out to remove.

                  Prevented only when there is nothing to search for, so a
                  click with a word in the box submits exactly as it did. And
                  it stays `type="submit"`: with JavaScript off this handler
                  never runs, the form posts, and the customer reaches the
                  results page rather than a dead icon.
                */
                onClick={(event) => {
                  if (term.trim() !== "") return;
                  event.preventDefault();
                  setPhoneSearchOpen(true);
                  searchInputRef.current?.focus();
                }}
                className="absolute left-1 top-1 flex size-9 items-center justify-center rounded-md text-muted-foreground"
              >
                <Search className="size-[1.125rem]" />
              </button>
              <input
                type="search"
                name="q"
                ref={searchInputRef}
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value);
                  setPanelOpen(true);
                }}
                onFocus={() => setPanelOpen(true)}
                onKeyDown={onSearchKeyDown}
                placeholder={
                  searchPlaceholder ||
                  `Search ${labels.productWordPlural.toLowerCase()}…`
                }
                aria-label="Search"
                /*
                  Combobox semantics, which this repo had none of to copy.
                  `autoComplete="off"` is not decoration either: the browser's
                  own history dropdown draws over this one, so without it a
                  returning customer sees two stacked lists, only one of which
                  knows what the shop sells.
                */
                role="combobox"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={suggestionsShowing}
                aria-controls={suggestListId}
                aria-activedescendant={
                  activeRow >= 0 ? `${suggestListId}-${activeRow}` : undefined
                }
                className="h-11 w-full rounded-lg border border-input bg-cream-50 pl-11 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />

              {/*
                THE ANSWERS, WHILE THE CUSTOMER IS STILL TYPING.

                Inside the form on purpose, and the click-outside listener
                tests for exactly that: a panel mounted as a sibling would be
                outside the form's subtree, the pointer-down that begins a tap
                on a row would close the panel, and the click would land on
                whatever the page moved underneath it. That bug is invisible
                on a desktop with a fast mouse and constant on a phone.

                Rows are real links, so the middle-click and the long-press
                that open a product in a new tab both work. Enter is handled
                on the input above rather than here, because the row is not
                what has focus — the box is, all the way through.
              */}
              {suggestionsShowing ? (
                <div
                  id={suggestListId}
                  role="listbox"
                  aria-label="Search suggestions"
                  className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
                >
                  {suggestions.map((row, index) => (
                    <Link
                      key={row.slug}
                      id={`${suggestListId}-${index}`}
                      role="option"
                      aria-selected={index === activeRow}
                      href={routes.store.cake(row.slug)}
                      onClick={() => {
                        setPanelOpen(false);
                        setPhoneSearchOpen(false);
                      }}
                      onMouseEnter={() => setActiveRow(index)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2",
                        index === activeRow && "bg-cream-100",
                      )}
                    >
                      {/*
                        A SQUARE THAT IS ALWAYS THERE, filled or not. A row
                        whose product has no picture would otherwise be
                        narrower than the five above it, and the names would
                        step sideways as the list changed under the typing.
                      */}
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-cream-50 text-xs font-semibold text-muted-foreground">
                        {row.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.image}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="size-full object-cover"
                          />
                        ) : (
                          row.name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">
                          {row.name}
                        </span>
                        {/*
                          The category, and nothing at all when the product
                          has none. An "in" with a blank after it is the shop
                          telling a customer something it does not know.
                        */}
                        {row.category ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            in {row.category}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
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
              /*
                IT OPENS THE BOX. IT USED TO LEAVE THE PAGE.

                `<Link href={routes.store.collections}>` — a control labelled
                Search that navigated to the unfiltered grid and offered
                nothing to type into. The shop said so directly: the search
                icon was still being sent to collections. It is the ONLY
                search control a phone has, and this shop's customers are on
                phones, so it was the majority experience of searching here.
              */
              aria-label="Search"
              aria-expanded={phoneSearchOpen}
              onClick={() => setPhoneSearchOpen((open) => !open)}
            >
              {phoneSearchOpen ? <X className="size-5" /> : <Search className="size-5" />}
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
            <div className="ml-1 hidden md:flex">
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
            <div className="ml-0.5 hidden md:flex">
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
        /*
          IT SLIDES, AND THE PAGE BELOW RIDES WITH IT.

          `grid-rows-[1fr]` to `[0fr]` rather than a height in pixels: the
          band is 46px today, but a shop that gives a nav row a badge makes it
          taller, and a hard-coded height would animate to the wrong place on
          that shop's storefront with nothing to say why. The fraction asks
          for "as tall as the content" and needs no number.

          The two hairlines are in the transition as well. Left out, they
          stayed at 1px each while the band between them went to nothing, so
          the slide finished on a 2px line that then blinked away.

          Written as data attributes on the node rather than React state, so
          scrolling this page end to end does not re-render a component that
          draws up to eleven menu subtrees. Inert below lg: the band is
          already `hidden` there and every rule keyed off the attributes is
          an `lg:` one, which is what makes "the phone header does not
          change" provable rather than asserted.

          `motion-reduce` because this is motion a customer can ask not to
          have; with it the band goes straight to its new size.
        */
        className="hidden lg:grid grid-rows-[1fr] border-y border-border bg-cream-100 transition-[grid-template-rows,border-top-width,border-bottom-width] duration-200 ease-out motion-reduce:transition-none lg:data-[collapsed=true]:grid-rows-[0fr] lg:data-[collapsed=true]:border-y-0 lg:data-[collapsed=true]:overflow-hidden lg:data-[animating=true]:overflow-hidden"
        data-collapsed="false"
        ref={navBandRef}
      >
        <nav
          /*
            `min-h-0` IS WHAT LETS THE BAND CLOSE AT ALL, AND THE PADDING HAD
            TO MOVE FOR THE SAME REASON.

            A grid item's automatic minimum size is its CONTENT size, so the
            row above went to `0fr` and stopped at 44 of its 46 pixels.
            `min-height: 0` lifts that floor — and then it stopped at 12,
            which is this row's own `py-1.5` top and bottom: padding is part
            of the box and does not shrink with it. Both measured, because a
            band that closes to 44px and a band that closes to 12px look like
            an animation that does not work rather than like a floor.

            So the padding sits on the row INSIDE, which the grid does not
            measure, and this element carries nothing but the column. The
            spill that allows is what the band's own clip is for.
          */
          className={cn(layoutSpacing.container, "min-h-0")}
          aria-label="Shop categories"
        >
        {/*
          `flex-wrap` BECAUSE ELEVEN ROWS DO NOT FIT.

          At 12px uppercase with 0.08em tracking, `px-3` a row and a chevron
          on each menu row, eleven labels come to roughly 1,195px against the
          960px column this band has at lg. Flex items do not shrink below
          min-content — for a single uppercase word that is the whole word —
          so without this the BAND hands the page a horizontal scrollbar, at
          exactly the row count the Header screen is about to reach. It does
          nothing until then.

          It must be `flex-wrap` and not `overflow-x-auto`: an overflow
          container clips its absolutely positioned descendants, so a scroller
          here would cut every mega panel off at the band's own height.

          `py-1.5` stays on THIS row, which is why the panels still hang from
          their own triggers: move it and `top-full` would resolve 6px below
          `.group`, the pointer would leave the group on its way down, and the
          menu would shut mid-travel.
        */}
        <div className="flex flex-wrap items-center gap-1 py-1.5">
        {bandRows.map((item, index) => {
          const isActive =
            pathname === item.href ||
            (item.href !== routes.store.home && pathname.startsWith(item.href));
          /**
           * WHICH EDGE THE PANEL HANGS FROM.
           *
           * `index >= floor(n/2)` assumed the band was FULL of rows, and it is
           * wrong in the opposite direction for a short one. Home is not in
           * the band, so a shop with Home and Collections visible has
           * `bandRows.length === 1`: `0 >= floor(1/2)` is true, its one menu
           * is anchored `right-0` to a trigger whose right edge is about 170px
           * from the left of the window, and the rest of the panel sits
           * off-screen to the LEFT — unreachable. Measured on this shop before
           * the fix: left edge at -469px, so 469 of 640px were gone.
           *
           * Off-screen LEFT adds nothing to `scrollWidth` in LTR, which is why
           * no guard in this repo ever went red for it, including the one that
           * exists to catch a panel leaving the window.
           *
           * Right-anchoring is only safe once the trigger's RIGHT edge is at
           * least a panel's width along the band. With rows at about 110px and
           * a panel of 27rem or less — see `panelShape`; 40rem is the
           * three-column case and is the one this arithmetic does not cover —
           * that is the fourth row onwards, which `floor(n/2)` reaches from six
           * rows up. Below six, every panel opens under its own trigger, where
           * it belongs.
           *
           * Still decided from position rather than measured, because measuring
           * means reading layout during render. Note the interaction with
           * `flex-wrap` above: once the band wraps, `index` stops tracking x at
           * all and a row at the head of the second line can still be
           * right-anchored. That is the residual, and it is written down rather
           * than fixed because the band does not wrap until about nine rows.
           */
          const align =
            bandRows.length >= 6 && index >= Math.floor(bandRows.length / 2)
              ? "right"
              : "left";
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
                  collections={chrome.collections}
                  words={chrome.menuWords}
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
                  /* `uppercase`, like the drawer's copy of this badge and
                     like both of the panel's. The same stored word read two
                     ways along one row. A plain comment rather than a JSX one: inside
                     a ternary arm a JSX expression container would be a second
                     child with no fragment round it. */
                  <span className="rounded-full bg-bakery-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bakery-700">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </div>
          );
        })}
        </div>
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
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-border bg-background lg:hidden"
        >
          <nav className="flex flex-col gap-1 px-4 py-4" aria-label="Mobile navigation">
            {/*
              WHERE THE ORDER IS GOING, AND IT IS FIRST FOR A REASON.

              The header's own pill is lg-and-up — 183px is most of a
              tablet's header row — and the note beside it had claimed for
              some time that the same check was 'a tap away in the drawer'.
              It was not: nothing rendered it here, so every phone customer
              had to reach a product page to find out whether the shop
              delivers to them.

              FIRST, because this opens a panel DOWNWARDS. Sat in the middle
              of the drawer it did open — and at 390x900 the panel landed at
              937..969, past both the fold and the drawer's own scroll box,
              so a customer tapped it and saw nothing happen. Measured, not
              guessed: it looked fine in the markup.
            */}
            {chrome.hasDeliveryZones ? (
              <div className="mb-2 border-b border-border pb-3">
                <DeliveryLocationButton />
              </div>
            ) : null}
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
                /*
                  THE SHOP'S OWN COLUMNS REACH THE PHONE TOO.

                  This row is filtered out of the map below, and nothing here
                  passed its `menu` — so a shop that wrote its own columns on
                  the Collections row saw them on a desktop and the taxonomy
                  fallback on a phone. The row the admin's own copy singles out
                  as the exception was the one row whose authored menu never
                  arrived, and the guard that requires `groups={item.menu}` in
                  the drawer stayed green on the OTHER rows.

                  `MobileShopLinks` already prefers authored groups over the
                  taxonomy, exactly as the desktop does, so this needs nothing
                  else.
                */
                groups={collectionsRow.menu}
                categories={chrome.categories}
                occasions={chrome.occasions}
                collections={chrome.collections}
                words={chrome.menuWords}
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
                <div key={item.id}>
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
              /*
                THE DRAWER'S SEARCH ROW, which was the same broken promise as
                the icon above it: a link to the unfiltered collections grid,
                labelled Search, with nothing to type into at the other end.

                It closes the drawer and opens the box — the same box, the
                same suggestions. A button rather than a link because nothing
                is being navigated to any more, and a link that does not
                navigate is a link a customer cannot open in a new tab and a
                screen reader announces wrongly.
              */
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  setPhoneSearchOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-cream-100"
              >
                <Search className="size-4" />
                Search
              </button>
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
