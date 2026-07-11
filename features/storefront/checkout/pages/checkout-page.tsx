"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Banknote,
  CreditCard,
  Loader2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { getCustomerSession } from "@/features/storefront/account/lib/customer-session";
import {
  getCommerceSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/admin/settings/lib/settings-repository";
import { DELIVERY_ZONES_UPDATED_EVENT } from "@/features/admin/commerce/lib/delivery-zones-repository";
import { defaultCommerceSettings } from "@/features/admin/settings/lib/settings-utils";
import { CheckoutProgress } from "@/features/storefront/checkout/components/checkout-progress";
import { CouponInput } from "@/features/storefront/checkout/components/coupon-input";
import { OrderSummaryPanel } from "@/features/storefront/checkout/components/order-summary-panel";
import { calculateCartTotals } from "@/features/storefront/checkout/lib/cart-totals";
import {
  clearCheckoutDraft,
  getCheckoutDraft,
  saveCheckoutDraft,
  type CheckoutAddress,
  type PaymentMethod,
} from "@/features/storefront/checkout/lib/checkout-draft";
import type { AppliedCoupon } from "@/features/storefront/checkout/lib/coupons";
import { recordCouponUsage } from "@/features/storefront/checkout/lib/coupons";
import { placeOrder } from "@/features/storefront/checkout/lib/orders";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { clearCart, clearCartPreferences, getCartItems, getCartPreferences } from "@/features/storefront/lib/cart";
import type { CartLineItem } from "@/features/storefront/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

const paymentOptions: {
  value: PaymentMethod;
  label: string;
  description: string;
  icon: typeof Banknote;
}[] = [
  {
    value: "cod",
    label: "Cash on Delivery",
    description: "Pay when your order is delivered",
    icon: Banknote,
  },
  {
    value: "upi",
    label: "UPI",
    description: "Google Pay, PhonePe, Paytm (demo)",
    icon: Smartphone,
  },
  {
    value: "card",
    label: "Credit / Debit Card",
    description: "Visa, Mastercard, RuPay (demo)",
    icon: CreditCard,
  },
];

export function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [coupon, setCoupon] = useState<AppliedCoupon | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [orderNotes, setOrderNotes] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [commerce, setCommerce] = useState(defaultCommerceSettings);

  const availablePaymentOptions = useMemo(
    () =>
      paymentOptions.filter((option) => commerce.paymentMethods[option.value]),
    [commerce.paymentMethods]
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState,
  } = useForm<CheckoutAddress>({
    defaultValues: getCheckoutDraft().address,
  });

  useEffect(() => {
    const cartItems = getCartItems();
    if (cartItems.length === 0) {
      router.replace(routes.store.cart);
      return;
    }

    const loadedCommerce = getCommerceSettings();
    setCommerce(loadedCommerce);

    const draft = getCheckoutDraft();
    const session = getCustomerSession();

    reset({
      fullName: draft.address.fullName || session?.name || "",
      email: draft.address.email || session?.email || "",
      phone: draft.address.phone || session?.phone || "",
      addressLine1: draft.address.addressLine1,
      addressLine2: draft.address.addressLine2,
      city: draft.address.city,
      state: draft.address.state,
      pincode: draft.address.pincode,
    });

    setItems(cartItems);
    setStep(draft.step);
    setCoupon(draft.coupon);
    const cartPreferences = getCartPreferences();
    setGiftWrap(cartPreferences.giftWrap);
    setOrderNotes(
      draft.orderNotes?.trim() ||
        cartPreferences.specialInstructions.trim() ||
        ""
    );

    const enabledMethods = paymentOptions.filter(
      (option) => loadedCommerce.paymentMethods[option.value]
    );
    const initialMethod = enabledMethods.some((option) => option.value === draft.paymentMethod)
      ? draft.paymentMethod
      : enabledMethods[0]?.value ?? "cod";
    setPaymentMethod(initialMethod);

    const stepParam = searchParams.get("step");
    if (stepParam === "3") {
      setStep(3);
    }

    setReady(true);
  }, [reset, router, searchParams]);

  useEffect(() => {
    const refreshCommerce = () => setCommerce(getCommerceSettings());
    window.addEventListener(SETTINGS_UPDATED_EVENT, refreshCommerce);
    window.addEventListener(DELIVERY_ZONES_UPDATED_EVENT, refreshCommerce);
    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refreshCommerce);
      window.removeEventListener(DELIVERY_ZONES_UPDATED_EVENT, refreshCommerce);
    };
  }, []);

  const watchedCity = watch("city");
  const watchedPincode = watch("pincode");

  const totals = useMemo(
    () =>
      calculateCartTotals({
        items,
        discount: coupon?.discountAmount ?? 0,
        giftWrap,
        deliveryAddress: {
          city: watchedCity,
          pincode: watchedPincode,
        },
        commerceOverride: commerce,
      }),
    [items, coupon, giftWrap, watchedCity, watchedPincode, commerce]
  );

  function persistDraft(
    patch: Partial<{
      step: 1 | 2 | 3;
      address: CheckoutAddress;
      paymentMethod: PaymentMethod;
      coupon?: AppliedCoupon;
      orderNotes?: string;
      paymentVerified?: boolean;
      paymentReference?: string;
    }>
  ) {
    const current = getCheckoutDraft();
    saveCheckoutDraft({
      ...current,
      ...patch,
      address: patch.address ?? current.address,
    });
  }

  const onDeliverySubmit = (address: CheckoutAddress) => {
    persistDraft({ step: 2, address });
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onPaymentContinue = () => {
    persistDraft({ paymentMethod, orderNotes });

    if (
      (paymentMethod === "upi" || paymentMethod === "card") &&
      !getCheckoutDraft().paymentVerified
    ) {
      router.push(`${routes.store.checkoutPayment}?method=${paymentMethod}`);
      return;
    }

    persistDraft({ step: 3, paymentMethod, orderNotes });
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onPlaceOrder = async () => {
    const draft = getCheckoutDraft();

    if (commerce.minOrderValue > 0 && totals.subtotal < commerce.minOrderValue) {
      toast.error(`Minimum order value is ${formatCurrency(commerce.minOrderValue)}`);
      return;
    }

    if (
      (paymentMethod === "upi" || paymentMethod === "card") &&
      !draft.paymentVerified
    ) {
      toast.error("Complete payment first");
      router.push(`${routes.store.checkoutPayment}?method=${paymentMethod}`);
      return;
    }

    const address = draft.address;
    setPlacing(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const order = placeOrder({
      items,
      totals,
      address,
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "cod" : "paid",
      paymentReference: draft.paymentReference,
      coupon,
      orderNotes: orderNotes.trim() || undefined,
    });

    if (coupon) {
      recordCouponUsage(coupon.code);
    }

    clearCart();
    clearCartPreferences();
    clearCheckoutDraft();
    setPlacing(false);

    toast.success("Order placed!", {
      description: `Order ${order.orderNumber} confirmed`,
    });

    router.push(`${routes.store.orderSuccess}?order=${order.orderNumber}`);
  };

  if (!ready) {
    return (
      <div className={layoutSpacing.container}>
        <div className="my-16 h-40 animate-pulse rounded-xl border border-border bg-cream-100" />
      </div>
    );
  }

  return (
    <>
      <StorePageHeader
        title="Checkout"
        description="Complete your delivery details and place your order."
        breadcrumbs={[
          { label: "Cart", href: routes.store.cart },
          { label: "Checkout" },
        ]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          <CheckoutProgress currentStep={step} className="mb-8" />

          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="order-2 space-y-6 lg:order-none lg:col-start-1">
              {step === 1 ? (
                <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                  <h2 className="font-heading text-lg font-semibold">Delivery details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Where should we deliver your cakes?
                  </p>

                  <form
                    className="mt-6 space-y-4"
                    onSubmit={handleSubmit(onDeliverySubmit)}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="fullName">Full name</Label>
                        <Input
                          id="fullName"
                          {...register("fullName", { required: "Name is required" })}
                        />
                        {formState.errors.fullName ? (
                          <p className="text-xs text-destructive">
                            {formState.errors.fullName.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          {...register("email", {
                            required: "Email is required",
                            pattern: {
                              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                              message: "Enter a valid email",
                            },
                          })}
                        />
                        {formState.errors.email ? (
                          <p className="text-xs text-destructive">
                            {formState.errors.email.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          type="tel"
                          {...register("phone", {
                            required: "Phone is required",
                            minLength: { value: 10, message: "Enter a valid phone" },
                          })}
                        />
                        {formState.errors.phone ? (
                          <p className="text-xs text-destructive">
                            {formState.errors.phone.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="addressLine1">Address line 1</Label>
                        <Input
                          id="addressLine1"
                          {...register("addressLine1", { required: "Address is required" })}
                        />
                        {formState.errors.addressLine1 ? (
                          <p className="text-xs text-destructive">
                            {formState.errors.addressLine1.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="addressLine2">Address line 2 (optional)</Label>
                        <Input id="addressLine2" {...register("addressLine2")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          {...register("city", { required: "City is required" })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          {...register("state", { required: "State is required" })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pincode">PIN code</Label>
                        <Input
                          id="pincode"
                          {...register("pincode", {
                            required: "PIN code is required",
                            pattern: { value: /^\d{6}$/, message: "Enter 6-digit PIN" },
                          })}
                        />
                        {formState.errors.pincode ? (
                          <p className="text-xs text-destructive">
                            {formState.errors.pincode.message}
                          </p>
                        ) : null}
                        {commerce.useZoneBasedDelivery && totals.deliveryZoneName ? (
                          <p className="text-xs text-bakery-700">
                            Delivery zone: {totals.deliveryZoneName}
                            {totals.estimatedDeliveryDays
                              ? ` · Est. ${totals.estimatedDeliveryDays} day(s)`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
                      <Button variant="outline" render={<Link href={routes.store.cart} />}>
                        Back to cart
                      </Button>
                      <Button type="submit" variant="bakery">
                        Continue to payment
                      </Button>
                    </div>
                  </form>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                    <h2 className="font-heading text-lg font-semibold">Payment method</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose how you would like to pay. UI-only — no real charges.
                    </p>

                    {availablePaymentOptions.length === 0 ? (
                      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        No payment methods are enabled. Ask the bakery to turn on COD, UPI, or
                        Card in admin Payments settings.
                      </div>
                    ) : (
                      <RadioGroup
                        value={paymentMethod}
                        onValueChange={(value) => {
                          const method = value as PaymentMethod;
                          setPaymentMethod(method);
                          persistDraft({
                            paymentMethod: method,
                            paymentVerified: false,
                            paymentReference: undefined,
                          });
                        }}
                        className="mt-6"
                      >
                        {availablePaymentOptions.map((option) => (
                          <label
                            key={option.value}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                              paymentMethod === option.value
                                ? "border-bakery-700 bg-cream-50"
                                : "border-border hover:bg-cream-50"
                            )}
                          >
                            <RadioGroupItem value={option.value} className="mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 font-medium">
                                <option.icon className="size-4 text-bakery-700" />
                                {option.label}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {option.description}
                              </p>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
                    )}

                    {paymentMethod !== "cod" && getCheckoutDraft().paymentVerified ? (
                      <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                        Payment verified
                        {getCheckoutDraft().paymentReference
                          ? ` · ${getCheckoutDraft().paymentReference}`
                          : ""}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                    <Label htmlFor="orderNotes">Order notes (optional)</Label>
                    <Textarea
                      id="orderNotes"
                      className="mt-2"
                      placeholder="Gate code, delivery instructions, etc."
                      value={orderNotes}
                      onChange={(event) => setOrderNotes(event.target.value)}
                    />
                  </div>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button
                      variant="bakery"
                      onClick={onPaymentContinue}
                      disabled={availablePaymentOptions.length === 0}
                    >
                      {paymentMethod === "cod"
                        ? "Review order"
                        : getCheckoutDraft().paymentVerified
                          ? "Review order"
                          : "Continue to payment"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-6">
                  <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                    <h2 className="font-heading text-lg font-semibold">Review & confirm</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Please verify your details before placing the order.
                    </p>

                    <div className="mt-6 space-y-4 text-sm">
                      <ReviewBlock title="Delivery to">
                        <p className="font-medium">{getCheckoutDraft().address.fullName}</p>
                        <p>{getCheckoutDraft().address.phone}</p>
                        <p>{getCheckoutDraft().address.email}</p>
                        <p className="text-muted-foreground">
                          {[
                            getCheckoutDraft().address.addressLine1,
                            getCheckoutDraft().address.addressLine2,
                            getCheckoutDraft().address.city,
                            getCheckoutDraft().address.state,
                            getCheckoutDraft().address.pincode,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </ReviewBlock>

                      <ReviewBlock title="Payment">
                        <p className="font-medium">
                          {availablePaymentOptions.find((option) => option.value === paymentMethod)?.label ??
                            paymentOptions.find((option) => option.value === paymentMethod)?.label}
                        </p>
                      </ReviewBlock>

                      {orderNotes ? (
                        <ReviewBlock title="Notes">
                          <p className="text-muted-foreground">{orderNotes}</p>
                        </ReviewBlock>
                      ) : null}
                    </div>

                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                      <Button variant="outline" onClick={() => setStep(2)}>
                        Back
                      </Button>
                      <Button
                        variant="bakery"
                        onClick={onPlaceOrder}
                        disabled={
                          placing ||
                          (commerce.minOrderValue > 0 && totals.subtotal < commerce.minOrderValue)
                        }
                      >
                        {placing ? <Loader2 className="size-4 animate-spin" /> : null}
                        {placing ? (
                          "Placing order…"
                        ) : (
                          <>
                            <span className="sm:hidden">Place order</span>
                            <span className="hidden sm:inline">
                              Place order · {formatCurrency(totals.total)}
                            </span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {commerce.minOrderValue > 0 && totals.subtotal < commerce.minOrderValue ? (
                    <p className="text-sm text-amber-700">
                      Minimum order value is {formatCurrency(commerce.minOrderValue)}. Add more items to continue.
                    </p>
                  ) : null}

                  <p className="text-center text-xs text-muted-foreground">
                    {commerce.checkoutTerms || (
                      <>
                        By placing your order, you agree to our{" "}
                        <Link href={routes.store.terms} className="text-bakery-700 hover:underline">
                          Terms of Service
                        </Link>
                        .
                      </>
                    )}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="order-1 space-y-4 lg:order-none lg:col-start-2 lg:sticky lg:top-24 lg:self-start">
              <OrderSummaryPanel
                items={items}
                totals={totals}
                giftWrapLabel={commerce.giftWrapLabel}
              />
              {step < 3 ? (
                <div className="rounded-xl border border-border bg-white p-4">
                  <p className="mb-3 text-sm font-medium">Have a coupon?</p>
                  <CouponInput
                    subtotal={totals.subtotal}
                    applied={coupon}
                    onApply={(next) => {
                      setCoupon(next);
                      persistDraft({ coupon: next });
                    }}
                    onRemove={() => {
                      setCoupon(undefined);
                      persistDraft({ coupon: undefined });
                    }}
                  />
                </div>
              ) : null}
              {!getCustomerSession() ? (
                <p className="text-center text-xs text-muted-foreground">
                  Have an account?{" "}
                  <Link href={routes.account.login} className="text-bakery-700 hover:underline">
                    Sign in
                  </Link>{" "}
                  for faster checkout next time.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-cream-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}
