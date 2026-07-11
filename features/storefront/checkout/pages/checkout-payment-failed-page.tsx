"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PaymentDemoNotice } from "@/features/storefront/checkout/components/payment-demo-notice";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import type { PaymentMethod } from "@/features/storefront/checkout/lib/checkout-draft";

function resolveMethod(value: string | null): PaymentMethod {
  if (value === "card" || value === "upi") return value;
  return "upi";
}

export function CheckoutPaymentFailedPage() {
  const searchParams = useSearchParams();
  const method = resolveMethod(searchParams.get("method"));
  const retryHref = `${routes.store.checkoutPayment}?method=${method}`;

  return (
    <>
      <StorePageHeader
        title="Payment Failed"
        description="We couldn't process your payment."
        breadcrumbs={[
          { label: "Checkout", href: routes.store.checkout },
          { label: "Payment Failed" },
        ]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <div className="rounded-xl border border-border bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-red-50">
              <AlertTriangle className="size-8 text-red-600" />
            </div>
            <h2 className="font-heading text-xl font-semibold">Payment unsuccessful</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Your payment could not be completed. No amount has been charged in this demo.
              Please try again or choose a different payment method.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button variant="bakery" render={<Link href={retryHref} />}>
                Retry payment
              </Button>
              <Button variant="outline" render={<Link href={routes.store.checkout} />}>
                Change method
              </Button>
            </div>

            <div className="mt-6 text-left">
              <PaymentDemoNotice />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
