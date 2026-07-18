"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { CreditCard, Loader2, QrCode, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { OrderSummaryPanel } from "@/features/storefront/checkout/components/order-summary-panel";
import { PaymentDemoNotice } from "@/features/storefront/checkout/components/payment-demo-notice";
import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import {
  getCheckoutDraft,
  saveCheckoutDraft,
  type PaymentMethod,
} from "@/features/orders/lib/checkout-draft";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { getCartItems, getCartPreferences } from "@/features/cart/lib/cart";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency } from "@/utils/format";

type CardPaymentForm = {
  cardName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
};

type UpiPaymentForm = {
  upiId: string;
};

function generatePaymentReference(method: PaymentMethod): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return method === "upi" ? `UPI-${suffix}` : `CARD-${suffix}`;
}

export function CheckoutPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const method = (searchParams.get("method") as PaymentMethod | null) ?? "upi";
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  const cardForm = useForm<CardPaymentForm>();
  const upiForm = useForm<UpiPaymentForm>({
    defaultValues: { upiId: "customer@upi" },
  });

  const items = useMemo(() => (ready ? getCartItems() : []), [ready]);
  const draft = useMemo(() => (ready ? getCheckoutDraft() : null), [ready]);
  const totals = useMemo(() => {
    const commerce = getCommerceSettings();
    return calculateCartTotals({
      items,
      discount: draft?.coupon?.discountAmount ?? 0,
      giftWrap: getCartPreferences().giftWrap,
      commerceOverride: commerce,
    });
  }, [items, draft]);

  useEffect(() => {
    const cartItems = getCartItems();
    const checkoutDraft = getCheckoutDraft();

    if (cartItems.length === 0) {
      router.replace(routes.store.cart);
      return;
    }

    if (!checkoutDraft.address.fullName || !checkoutDraft.address.email) {
      router.replace(routes.store.checkout);
      return;
    }

    if (method === "cod") {
      router.replace(routes.store.checkout);
      return;
    }

    if (method !== "upi" && method !== "card") {
      router.replace(routes.store.checkout);
      return;
    }

    setReady(true);
  }, [method, router]);

  async function completePayment() {
    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const reference = generatePaymentReference(method);
    const current = getCheckoutDraft();
    saveCheckoutDraft({
      ...current,
      step: 3,
      paymentMethod: method,
      paymentVerified: true,
      paymentReference: reference,
    });

    setProcessing(false);
    toast.success("Payment successful", { description: `Reference ${reference}` });
    router.push(`${routes.store.checkout}?step=3`);
  }

  async function handleCardSubmit() {
    await completePayment();
  }

  async function handleUpiSubmit() {
    await completePayment();
  }

  if (!ready || !draft) {
    return (
      <div className={layoutSpacing.container}>
        <div className="my-16 h-40 animate-pulse rounded-xl border border-border bg-cream-100" />
      </div>
    );
  }

  const title = method === "upi" ? "Pay with UPI" : "Pay with card";

  return (
    <>
      <StorePageHeader
        title={title}
        description="Complete your payment securely to continue checkout."
        breadcrumbs={[
          { label: "Cart", href: routes.store.cart },
          { label: "Checkout", href: routes.store.checkout },
          { label: "Payment" },
        ]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="order-2 rounded-xl border border-border bg-white p-6 shadow-sm lg:order-none lg:col-start-1">
              <div className="flex items-center gap-2">
                {method === "upi" ? (
                  <Smartphone className="size-5 text-bakery-700" />
                ) : (
                  <CreditCard className="size-5 text-bakery-700" />
                )}
                <h2 className="font-heading text-lg font-semibold">{title}</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Amount due: <span className="font-semibold text-foreground">{formatCurrency(totals.total)}</span>
              </p>

              {method === "upi" ? (
                <div className="mt-6 space-y-4">
                  <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-cream-50 p-8 text-center">
                    <QrCode className="size-16 text-bakery-700" />
                    <p className="mt-3 text-sm font-medium">Scan QR to pay</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Demo QR — use any UPI app or enter ID below
                    </p>
                  </div>

                  <form className="space-y-4" onSubmit={upiForm.handleSubmit(handleUpiSubmit)}>
                    <div className="space-y-2">
                      <Label htmlFor="upiId">UPI ID</Label>
                      <Input
                        id="upiId"
                        placeholder="yourname@upi"
                        {...upiForm.register("upiId", { required: "UPI ID is required" })}
                      />
                    </div>
                    <Button type="submit" variant="bakery" className="w-full" disabled={processing}>
                      {processing ? <Loader2 className="size-4 animate-spin" /> : null}
                      {processing ? "Verifying payment…" : "I have paid"}
                    </Button>
                  </form>
                </div>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={cardForm.handleSubmit(handleCardSubmit)}>
                  <div className="space-y-2">
                    <Label htmlFor="cardName">Name on card</Label>
                    <Input
                      id="cardName"
                      placeholder="Priya Sharma"
                      {...cardForm.register("cardName", { required: "Required" })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Card number</Label>
                    <Input
                      id="cardNumber"
                      placeholder="4111 1111 1111 1111"
                      {...cardForm.register("cardNumber", {
                        required: "Required",
                        minLength: { value: 12, message: "Enter a valid card number" },
                      })}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Expiry</Label>
                      <Input
                        id="expiry"
                        placeholder="MM/YY"
                        {...cardForm.register("expiry", { required: "Required" })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVV</Label>
                      <Input
                        id="cvv"
                        placeholder="123"
                        {...cardForm.register("cvv", {
                          required: "Required",
                          minLength: { value: 3, message: "3 digits" },
                        })}
                      />
                    </div>
                  </div>
                  <Button type="submit" variant="bakery" className="w-full" disabled={processing}>
                    {processing ? <Loader2 className="size-4 animate-spin" /> : null}
                    {processing ? "Processing…" : `Pay ${formatCurrency(totals.total)}`}
                  </Button>
                </form>
              )}

              <PaymentDemoNotice />

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button variant="outline" render={<Link href={routes.store.checkout} />}>
                  Back to checkout
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive"
                  render={
                    <Link
                      href={`${routes.store.checkoutPaymentFailed}?method=${method}`}
                    />
                  }
                >
                  Simulate failed payment
                </Button>
              </div>
            </div>

            <div className="order-1 lg:order-none lg:col-start-2 lg:sticky lg:top-24 lg:self-start">
              <OrderSummaryPanel
                items={items}
                totals={totals}
                giftWrapLabel={getCommerceSettings().giftWrapLabel}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
