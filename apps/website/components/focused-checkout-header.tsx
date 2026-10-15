"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { OPEN_AUTH_MODAL_EVENT } from "@/apps/website/account/lib/auth-modal-events";
import { BrandMark } from "@/components/shared/brand-mark";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

// Same lazy split as the navbar: the sign-in flow downloads when it is asked for.
const CustomerAuthModal = dynamic(
  () => import("@/apps/website/account/components/customer-auth-modal").then((m) => m.CustomerAuthModal),
  { ssr: false },
);

/**
 * THE HEADER WHILE THE CUSTOMER IS PAYING — the logo and a word of
 * reassurance, nothing to wander off through. The reference drops its menu
 * and search on the cart and checkout for this reason. The logo still goes
 * home, so nobody is trapped.
 *
 * It MUST host the sign-in dialog: the navbar does on every other page, and
 * the cart's "Sign in to checkout" asks for it with a window event that
 * nothing would answer otherwise.
 */
export function FocusedCheckoutHeader({
  logo,
  logoLetter,
  siteName,
}: {
  logo: string;
  logoLetter: string;
  siteName: string;
}) {
  const [authOpen, setAuthOpen] = useState(false);
  const [authRequested, setAuthRequested] = useState(false);
  if (authOpen && !authRequested) setAuthRequested(true);
  const [authStep, setAuthStep] = useState<"phone" | "signup">("phone");

  useEffect(() => {
    const onOpen = (event: Event) => {
      setAuthStep((event as CustomEvent<{ step?: "phone" | "signup" }>).detail?.step ?? "phone");
      setAuthOpen(true);
    };
    window.addEventListener(OPEN_AUTH_MODAL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_AUTH_MODAL_EVENT, onOpen);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className={cn(layoutSpacing.container, "flex h-16 items-center justify-between gap-4")}>
          <Link
            href={routes.store.home}
            className="flex min-w-0 max-w-[10rem] shrink-0 items-center gap-2.5 sm:max-w-[14rem]"
          >
            <BrandMark logo={logo} logoLetter={logoLetter} siteName={siteName} />
          </Link>
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="size-5 text-green-700" aria-hidden />
            <span>
              <span className="hidden sm:inline">100% </span>Secure checkout
            </span>
          </p>
        </div>
      </header>
      {authRequested ? (
        <CustomerAuthModal
          open={authOpen}
          onOpenChange={setAuthOpen}
          initialStep={authStep}
          // Each page re-reads the session from the same event the navbar
          // relies on; nothing here needs to hold it.
          onAuthenticated={() => undefined}
        />
      ) : null}
    </>
  );
}
