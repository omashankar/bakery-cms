"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { OPEN_AUTH_MODAL_EVENT } from "@/apps/website/account/lib/auth-modal-events";
import { CheckoutProgress } from "@/apps/website/checkout/components/checkout-progress";
import { useCheckoutStep } from "@/apps/website/checkout/lib/checkout-step-store";
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
  const current = useCheckoutStep();
  const onCheckout = (usePathname() ?? "").startsWith(routes.store.checkout);

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
      {/*
        Sticky from md only: on a phone the steps take a second row, and a
        two-row bar pinned over a 844px screen is a lot of glass.
      */}
      <header className="border-b border-border bg-background/95 backdrop-blur md:sticky md:top-0 md:z-50">
        <div
          className={cn(
            layoutSpacing.container,
            "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 py-3 md:grid-cols-[1fr_minmax(0,34rem)_1fr] md:py-2.5",
          )}
        >
          <Link
            href={routes.store.home}
            className="flex min-w-0 max-w-[10rem] shrink-0 items-center gap-2.5 sm:max-w-[14rem]"
          >
            <BrandMark logo={logo} logoLetter={logoLetter} siteName={siteName} />
          </Link>
          {/*
            THE STEPS IN THE HEADER, where the reference has them — the page
            then opens straight on its own heading. The page publishes which
            step it is on; until it does, the path says (cart, or checkout's
            first step), so the server render already shows the right one.
          */}
          {current?.hidden ? <span className="hidden md:block" /> : (
          <CheckoutProgress
            currentStep={current?.step ?? (onCheckout ? 1 : 0)}
            onStepSelect={current?.onSelect}
            className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1"
          />
          )}
          <p className="flex items-center justify-end gap-1.5 text-sm font-medium text-muted-foreground md:col-start-3">
            <ShieldCheck className="size-5 text-green-700" aria-hidden />
            <span>
              <span className="hidden lg:inline">100% </span>Secure checkout
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
