"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import {
  AdminHeader,
  AdminSidebar,
} from "@/apps/admin/components";
import { adminShell } from "@/apps/admin/components/admin-shell";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useSessionRefresh } from "@/features/auth/lib/use-session-refresh";
import { SessionGuard } from "@/features/auth/components/session-guard";
import { useProductCacheSync } from "@/features/products/data/use-product-cache-sync";
import { useInventoryServerSync } from "@/apps/admin/commerce/lib/use-inventory-server-sync";
import { useOrdersServerSync } from "@/features/orders/lib/use-orders-server-sync";
import { useInvoiceSettingsServerSync } from "@/features/commerce/lib/use-invoice-settings-server-sync";
import { useCustomersServerSync } from "@/apps/admin/commerce/lib/use-customers-server-sync";
import { useMediaServerSync } from "@/apps/admin/media/lib/use-media-server-sync";
import { usePagesServerSync } from "@/features/content/lib/use-pages-server-sync";
import { useCommunicationsServerSync } from "@/apps/admin/communications/lib/use-communications-server-sync";
import { useInquiriesServerSync } from "@/features/inquiries/lib/use-inquiries-server-sync";
import { useNewsletterServerSync } from "@/features/inquiries/lib/use-newsletter-server-sync";
import { useReviewsServerSync } from "@/features/reviews/lib/use-reviews-server-sync";
import { useSeoServerSync } from "@/features/seo/lib/use-seo-server-sync";
import { useAdminConfigServerSync } from "@/features/admin-config/lib/use-admin-config-server-sync";
import { useSecurityCenterServerSync } from "@/features/settings/lib/use-security-center-server-sync";
import { ensureSiteLayoutHydrated } from "@/components/shared/site-layout-server-sync";
import { useIdle } from "@/hooks/use-idle";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "bakery-cms-sidebar-collapsed";

interface AdminLayoutShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Every admin cache this browser keeps, refilled from the server.
 *
 * These are the SEARCH INDEX and the screens’ offline copies, not the data the
 * page in front of the admin is rendering — each screen fetches its own. They
 * are collected into a child component so the layout can mount them a beat
 * later; see the call site.
 */
function AdminDataHydration(): null {
  // Refresh the browser product cache from the server, for the admin screens
  // that still read it synchronously (inventory, dashboard, global search).
  useProductCacheSync();
  // Hydrate inventory stock history + settings from the server.
  useInventoryServerSync();
  // Hydrate all orders from the server (so admin sees orders from any device).
  useOrdersServerSync();
  // Hydrate invoice settings from the server.
  useInvoiceSettingsServerSync();
  // Hydrate admin-managed customer metadata (tags/notes/marketing) from the server.
  useCustomersServerSync();
  // Hydrate the media library (files + folders) from the server. Stays here,
  // unlike the media USAGE index: the dashboard tiles, the global search and
  // the product form’s media picker all read this one.
  useMediaServerSync();
  // Hydrate the CMS pages so the admin global search finds the real ones.
  usePagesServerSync();
  // Hydrate email/WhatsApp templates + notification settings from the server.
  useCommunicationsServerSync();
  // Hydrate inquiries (contact-form submissions) from the server.
  useInquiriesServerSync();
  // Hydrate newsletter subscribers from the server.
  useNewsletterServerSync();
  // Hydrate product reviews (all moderation states) from the server.
  useReviewsServerSync();
  // Hydrate SEO settings (global + per-route) from the server.
  useSeoServerSync();
  // Hydrate admin-only config blobs (profile, gateways, notif prefs, custom code).
  useAdminConfigServerSync();
  // Hydrate the Security Center — derived from the real audit trail + sessions.
  useSecurityCenterServerSync();
  /**
   * Header, footer and appearance — moved off the ROOT providers.
   *
   * These three reads are admin-only (they answer 401 to anyone else), so
   * mounting them globally meant three refused requests on every customer
   * page view and nothing gained. Here they run for the only session that can
   * actually read them. The admin screens that WRITE these still call
   * `ensureSiteLayoutHydrated()` themselves before unlocking a save, which is
   * what covers signing in through the login form and soft-navigating in.
   */
  useEffect(() => {
    void ensureSiteLayoutHydrated();
  }, []);
  return null;
}

export function AdminLayoutShell({ children, className }: AdminLayoutShellProps) {
  // Keep the access token fresh (renew on mount + every 10 min + on refocus) so
  // the hydration calls don’t start 401-ing after the 15-min token expiry. Eager,
  // and the only one that is: every deferred read below depends on it working.
  useSessionRefresh();

  /**
   * The background caches start filling AFTER the page the admin actually
   * opened has had its turn.
   *
   * Fifteen hooks ran in this component’s mount effect, and between them they
   * fired around thirty requests — every order, every product, the whole media
   * library, reviews, inquiries, templates — on entering ANY admin screen,
   * Settings → SMTP included. The screen’s own fetch went out in the same
   * flush and then queued behind all of them, on one Node process talking to a
   * remote database. The dashboard was the worst hit because it is the one
   * people open first.
   *
   * Nothing is dropped and no request is removed — they are deferred by a
   * fraction of a second, so the current page goes first. That is safe because
   * of how these caches are already written: every screen that must not act on
   * a stale copy calls its own `ensure…Hydrated()` before unlocking a save
   * (inventory, communications, profile, SEO, custom code, backup), and the
   * screens that merely display a cache subscribe to its update event and
   * re-render when it lands.
   */
  const backgroundDataReady = useIdle(1000);
  const pathname = usePathname();
  const isBuilder =
    pathname === routes.admin.builders.homepage ||
    pathname === routes.admin.builders.wedding;
  const mobileNavId = useId();
  // Must match the server render. The persisted preference is applied after
  // mount (below) — reading localStorage during the first render would disagree
  // with the server HTML and force React to discard the whole tree.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasMobileOpen = useRef(false);

  const closeMobile = () => setMobileOpen(false);
  const toggleMobile = () => setMobileOpen((open) => !open);

  useBodyScrollLock(mobileOpen);

  // Prevent a second window scrollbar when tall sidebar/main content would expand <body>
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      // ignore storage errors
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed, hydrated]);

  useEffect(() => {
    if (!mobileOpen) {
      if (wasMobileOpen.current) {
        menuButtonRef.current?.focus();
      }
      wasMobileOpen.current = false;
      return;
    }

    wasMobileOpen.current = true;
    const drawer = drawerRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobile();
        return;
      }
      if (event.key !== "Tab" || !drawer) return;

      const focusable = drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    // Prefer first nav link over the decorative close control
    const firstNav = drawer?.querySelector<HTMLElement>("nav a[href]");
    (firstNav ?? drawer)?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  // Close mobile drawer when viewport reaches desktop sidebar breakpoint
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setMobileOpen(false);
    }
    media.addEventListener("change", onChange);
    if (media.matches) setMobileOpen(false);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSidebarToggle = () => setCollapsed((prev) => !prev);

  return (
    <div
      className={cn(
        // min-h-0: body is a flex column — without it, tall sidebar content expands this shell past 100dvh and creates a second (document) scrollbar.
        "flex h-dvh min-h-0 overflow-hidden print:h-auto print:min-h-0 print:overflow-visible print:bg-white",
        adminShell.pageBg,
        className
      )}
    >
      {/* Renders nothing; it exists to own the background hydration effects. */}
      {backgroundDataReady ? <AdminDataHydration /> : null}

      <aside
        className={cn(
          "hidden min-h-0 shrink-0 overflow-hidden border-r lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col print:hidden",
          // Only animate user-driven toggles — restoring the saved state on load
          // should snap, not play a collapse animation on every page view.
          hydrated && "transition-[width] duration-200 ease-out",
          adminShell.border,
          adminShell.sidebarBg,
          collapsed ? adminShell.sidebarCollapsedWidth : adminShell.sidebarWidth
        )}
      >
        <AdminSidebar collapsed={collapsed} className="w-full min-h-0" />
      </aside>

      {/* Keep mounted for slide animation; z-[100] stays above header (z-40) */}
      <div
        className={cn(
          "fixed inset-0 z-[100] print:hidden lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          tabIndex={mobileOpen ? 0 : -1}
          className={cn(
            "absolute inset-0 bg-black/45 transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={closeMobile}
          aria-label="Close menu overlay"
        />
        <aside
          id={mobileNavId}
          ref={drawerRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
          inert={!mobileOpen ? true : undefined}
          className={cn(
            "relative flex h-full max-h-dvh w-[min(100%,20rem)] max-w-[85vw] flex-col border-r shadow-sm outline-none transition-transform duration-200 ease-out",
            "pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)]",
            adminShell.border,
            adminShell.sidebarBg,
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="absolute top-2.5 right-2.5 z-10">
            <Button
              variant="ghost"
              size="icon"
              className={adminShell.iconButton}
              onClick={closeMobile}
              tabIndex={mobileOpen ? 0 : -1}
              aria-label="Close menu"
            >
              <X className="size-4" />
            </Button>
          </div>
          <AdminSidebar collapsed={false} inDrawer onNavigate={closeMobile} />
        </aside>
      </div>

      {/*
        Inside the shell so it is present on every admin screen, and mounted
        once: the session belongs to the browser, not to a page.
      */}
      <SessionGuard />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        <div className="shrink-0 print:hidden">
          <AdminHeader
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            mobileNavId={mobileNavId}
            menuButtonRef={menuButtonRef}
            onMobileMenuToggle={toggleMobile}
            onSidebarToggle={handleSidebarToggle}
          />
        </div>

        <main
          className={cn(
            "min-h-0 flex-1",
            // Builders fill the viewport; list/settings pages scroll by content height only.
            // flex-1 + overflow-y-auto on the same node inflates scrollHeight (empty gap on SEO etc.).
            // Builder pages full-bleed via -my-* on their root; that padding must live on the SAME
            // element as overflow-hidden (contentWrap), else the negative margin overshoots the clip
            // box and the toolbar title gets cut off. So keep vertical padding off <main> for builders.
            isBuilder
              ? "flex flex-col overflow-hidden"
              : cn("overflow-y-auto panel-scroll", adminShell.mainPadding),
            "print:overflow-visible print:p-0"
          )}
        >
          <div
            className={cn(
              adminShell.contentWrap,
              isBuilder &&
                cn(
                  "flex min-h-0 flex-1 flex-col overflow-hidden",
                  adminShell.mainPadding
                ),
              "print:max-w-none print:overflow-visible print:px-0"
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
