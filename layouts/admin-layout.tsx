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
import { useProductCacheSync } from "@/features/products/data/use-product-cache-sync";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "bakery-cms-sidebar-collapsed";

interface AdminLayoutShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AdminLayoutShell({ children, className }: AdminLayoutShellProps) {
  // Refresh the browser product cache from the server, for the admin screens
  // that still read it synchronously (inventory, dashboard, global search).
  useProductCacheSync();

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
