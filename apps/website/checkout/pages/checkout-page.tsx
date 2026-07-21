"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Banknote,
  CreditCard,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getCustomerSession } from "@/apps/website/account/lib/customer-session";
import {
  createSavedAddress,
  getDefaultAddress,
  getSavedAddresses,
  updateSavedAddress,
  type SavedAddress,
} from "@/apps/website/account/lib/customer-addresses";
import { openRazorpayCheckout } from "@/apps/website/checkout/lib/razorpay";
import { getEnabledCheckoutMethods } from "@/features/payments/lib/resolve-methods";
import { PaymentMethodList } from "@/apps/website/checkout/payments/payment-method-list";
import { SecurityBadges } from "@/features/payments/components/security-badges";
import {
  ProcessingState,
  type PaymentUIState,
} from "@/features/payments/components/processing-state";
import { openCustomerAuthModal } from "@/apps/website/account/components/customer-auth-modal";
import {
  getCommerceSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { DELIVERY_ZONES_UPDATED_EVENT } from "@/features/commerce/lib/delivery-zones-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { CartIssuesAlert } from "@/apps/website/checkout/components/cart-issues-alert";
import { DeliveryAddressPicker } from "@/apps/website/checkout/components/delivery-address-picker";
import { CheckoutProgress } from "@/apps/website/checkout/components/checkout-progress";
import { CouponInput } from "@/apps/website/checkout/components/coupon-input";
import { OrderSummaryPanel } from "@/apps/website/checkout/components/order-summary-panel";
import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import {
  clearCheckoutDraft,
  EMPTY_CHECKOUT_ADDRESS,
  EMPTY_DELIVERY_SLOT,
  getCheckoutDraft,
  hasDeliverySlot,
  saveCheckoutDraft,
  type CheckoutAddress,
  type DeliverySlot,
  type PaymentMethod,
} from "@/features/orders/lib/checkout-draft";
import {
  getDeliveryTimeSlots,
  getMinDeliveryDate,
} from "@/apps/website/lib/product-details";
import type { AppliedCoupon } from "@/features/orders/lib/coupons";
import { recordCouponUsage, revalidateCoupon } from "@/features/orders/lib/coupons";
import {
  hasBlockingCartIssues,
  validateCartAgainstCatalog,
} from "@/features/orders/lib/cart-validation";
import type { LandingProduct } from "@/constants/landing-data";
import { placeOrder } from "@/features/orders/lib/orders";
import { grantOrderAccess } from "@/features/orders/lib/order-access";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import {
  clearCart,
  clearCartPreferences,
  getCartItems,
  getCartPreferences,
  subscribeToCart,
  updateCartPreferences,
} from "@/features/cart/lib/cart";
import type { CartLineItem } from "@/features/cart/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { formatCurrency } from "@/utils/format";

const paymentOptions: {
  value: PaymentMethod;
  label: string;
  description: string;
  icon: typeof Banknote;
}[] = [
  {
    value: "razorpay",
    label: "Pay Online",
    description: "UPI, Cards, Netbanking & Wallets — secured by Razorpay",
    icon: CreditCard,
  },
  {
    value: "cod",
    label: "Cash on Delivery",
    description: "Pay when your order is delivered",
    icon: Banknote,
  },
];

/** Strip the address-book fields the checkout form does not carry. */
function toCheckoutAddress(saved: SavedAddress): CheckoutAddress {
  return {
    fullName: saved.fullName,
    email: saved.email,
    phone: saved.phone,
    addressLine1: saved.addressLine1,
    addressLine2: saved.addressLine2 ?? "",
    city: saved.city,
    state: saved.state,
    pincode: saved.pincode,
  };
}

/** Same delivery destination, ignoring formatting differences. */
function isSameAddress(a: Partial<CheckoutAddress>, b: Partial<CheckoutAddress>): boolean {
  const norm = (value?: string) => (value ?? "").trim().toLowerCase();
  return (
    norm(a.addressLine1) === norm(b.addressLine1) &&
    norm(a.addressLine2) === norm(b.addressLine2) &&
    norm(a.city) === norm(b.city) &&
    norm(a.state) === norm(b.state) &&
    norm(a.pincode) === norm(b.pincode)
  );
}

/** The fields an order genuinely cannot be delivered without. */
function hasDeliverableAddress(address?: Partial<CheckoutAddress>): boolean {
  if (!address) return false;
  return Boolean(
    address.fullName?.trim() &&
      address.phone?.trim() &&
      address.addressLine1?.trim() &&
      address.city?.trim() &&
      address.state?.trim() &&
      address.pincode?.trim()
  );
}

interface CheckoutPageProps {
  /** Live published catalogue, fetched on the server. */
  catalog: LandingProduct[];
}

export function CheckoutPage({ catalog }: CheckoutPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [coupon, setCoupon] = useState<AppliedCoupon | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [orderNotes, setOrderNotes] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [deliverySlot, setDeliverySlot] = useState<DeliverySlot>(EMPTY_DELIVERY_SLOT);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotOptions, setSlotOptions] = useState<string[]>([]);
  const [minDeliveryDate, setMinDeliveryDate] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  /** A saved address id, or "new" while entering one by hand. */
  const [addressChoice, setAddressChoice] = useState<string>("new");
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  /** Set when editing an existing saved address rather than adding one. */
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  /** The form is only shown when adding or editing — otherwise the cards are enough. */
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [commerce, setCommerce] = useState(defaultCommerceSettings);
  // Null while unknown — do not hide a method on a guess.
  const [onlinePaymentReady, setOnlinePaymentReady] = useState<boolean | null>(null);

  const availablePaymentOptions = useMemo(
    () =>
      paymentOptions.filter(
        (option) =>
          commerce.paymentMethods[option.value] &&
          (option.value !== "razorpay" || onlinePaymentReady !== false)
      ),
    [commerce.paymentMethods, onlinePaymentReady]
  );

  // Offering "Pay Online" when the gateway has no keys means the customer
  // completes the entire checkout and only discovers it at the final click.
  // Ask the server up front instead.
  useEffect(() => {
    let cancelled = false;

    async function checkGateway() {
      try {
        const response = await fetch("/api/razorpay/config");
        const status = await response.json();
        if (!cancelled) setOnlinePaymentReady(Boolean(status?.configured));
      } catch {
        if (!cancelled) setOnlinePaymentReady(null);
      }
    }

    void checkGateway();
    return () => {
      cancelled = true;
    };
  }, []);

  // Registry-driven method cards shown at the payment step.
  const enabledMethods = useMemo(
    () =>
      ready
        ? getEnabledCheckoutMethods().filter(
            (method) => method.id !== "razorpay" || onlinePaymentReady !== false
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, commerce.paymentMethods, onlinePaymentReady]
  );

  useEffect(() => {
    if (onlinePaymentReady !== false || paymentMethod !== "razorpay") return;
    const fallback = availablePaymentOptions[0]?.value ?? "cod";
    setPaymentMethod(fallback);
  }, [onlinePaymentReady, paymentMethod, availablePaymentOptions]);

  // Online payment processing / failure overlay state.
  const [payUI, setPayUI] = useState<{ state: PaymentUIState; reason?: string } | null>(null);

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
    // Being bounced back to the cart with no explanation reads as a broken
    // button, so say why before moving them.
    if (!getCustomerSession()) {
      toast.info("Please sign in to continue to checkout");
      router.replace(routes.store.cart);
      return;
    }

    const cartItems = getCartItems();
    if (cartItems.length === 0) {
      toast.info("Your cart is empty — add a cake to check out");
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

    const addresses = getSavedAddresses();
    setSavedAddresses(addresses);

    // A customer who has already given us an address should not retype it.
    // A draft in progress still wins — they may have edited it this session.
    const draftHasAddress = Boolean(draft.address.addressLine1?.trim());
    const preferred = draftHasAddress ? null : getDefaultAddress();
    if (preferred) {
      setAddressChoice(preferred.id);
      reset(toCheckoutAddress(preferred));
    } else if (draftHasAddress) {
      const matching = addresses.find((entry) => isSameAddress(entry, draft.address));
      setAddressChoice(matching?.id ?? "new");
      // A typed-but-unsaved address must stay editable on return.
      if (!matching) setShowAddressForm(true);
    }
    // Nothing to choose from: go straight to the form.
    if (addresses.length === 0) setShowAddressForm(true);

    setItems(cartItems);
    setDeliverySlot(draft.deliverySlot ?? EMPTY_DELIVERY_SLOT);
    setSlotOptions(getDeliveryTimeSlots());
    setMinDeliveryDate(getMinDeliveryDate());
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

    // ?step=3 is a deep link back into Review. Only honour it when the draft
    // already holds a deliverable address — otherwise the URL alone would skip
    // the address form and place an order with nowhere to send it.
    const stepParam = searchParams.get("step");
    if (stepParam === "3" && hasDeliverableAddress(draft.address)) {
      setStep(3);
    }

    setReady(true);
  }, [reset, router, searchParams]);

  /** Moves between steps and records it in history, so Back walks the flow. */
  function goToStep(next: 1 | 2 | 3) {
    setStep(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 1) params.delete("step");
    else params.set("step", String(next));
    const query = params.toString();
    router.push(query ? `?${query}` : routes.store.checkout, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Browser Back/Forward changes the URL; follow it back into the right step.
  useEffect(() => {
    if (!ready) return;
    const param = Number(searchParams.get("step"));
    const target: 1 | 2 | 3 = param === 2 || param === 3 ? param : 1;
    if (target === step) return;
    // Never land on a later step without an address to deliver to.
    if (target > 1 && !hasDeliverableAddress(getCheckoutDraft().address)) return;
    setStep(target);
  }, [searchParams, ready, step]);

  // The cart is read once on mount. Keep it in step with edits made anywhere
  // else — including another tab — so the summary, the totals and the order
  // that gets placed all describe the same cart.
  useEffect(() => {
    return subscribeToCart(() => {
      const next = getCartItems();
      if (next.length === 0) {
        toast.info("Your cart is now empty — add a cake to check out");
        router.replace(routes.store.cart);
        return;
      }
      setItems(next);
    });
  }, [router]);

  useEffect(() => {
    const refreshCommerce = () => setCommerce(getCommerceSettings());
    window.addEventListener(SETTINGS_UPDATED_EVENT, refreshCommerce);
    window.addEventListener(DELIVERY_ZONES_UPDATED_EVENT, refreshCommerce);
    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refreshCommerce);
      window.removeEventListener(DELIVERY_ZONES_UPDATED_EVENT, refreshCommerce);
    };
  }, []);

  // A cart can sit in localStorage for weeks. Re-check it against the live
  // catalogue so an unpublished, deleted or out-of-stock product cannot be paid
  // for — nothing downstream re-validates it.
  const cartIssues = useMemo(
    () => validateCartAgainstCatalog(items, catalog),
    [items, catalog]
  );
  const cartBlocked = hasBlockingCartIssues(cartIssues);

  const watchedCity = watch("city");
  const watchedPincode = watch("pincode");

  // The coupon was validated against whatever the cart held when it was
  // applied. Re-check it against the cart being paid for, so an edited cart
  // cannot keep a discount it no longer qualifies for.
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );
  const validCoupon = useMemo(() => revalidateCoupon(coupon, subtotal), [coupon, subtotal]);

  const totals = useMemo(
    () =>
      calculateCartTotals({
        items,
        discount: validCoupon?.discountAmount ?? 0,
        giftWrap,
        deliveryAddress: {
          city: watchedCity,
          pincode: watchedPincode,
        },
        commerceOverride: commerce,
      }),
    [items, validCoupon, giftWrap, watchedCity, watchedPincode, commerce]
  );

  function persistDraft(
    patch: Partial<{
      step: 1 | 2 | 3;
      address: CheckoutAddress;
      deliverySlot: DeliverySlot;
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
    if (!hasDeliverySlot(deliverySlot)) {
      setSlotError("Choose a delivery date and time");
      return;
    }
    setSlotError(null);

    // Keeping the address book current is a convenience — it must never block
    // the order, so every path here is best-effort.
    try {
      if (editingAddressId) {
        updateSavedAddress(editingAddressId, address);
        setSavedAddresses(getSavedAddresses());
        toast.success("Address updated");
      } else {
        const alreadySaved = savedAddresses.some((entry) => isSameAddress(entry, address));
        if (saveNewAddress && !alreadySaved) {
          const created = createSavedAddress({
            ...address,
            label: address.city?.trim() || "Address",
            isDefault: savedAddresses.length === 0,
          });
          setSavedAddresses(getSavedAddresses());
          setAddressChoice(created.id);
          toast.success("Address saved for next time");
        }
      }
    } catch {
      // Ignore — the order still goes through with the address as typed.
    }

    setShowAddressForm(false);
    setEditingAddressId(null);

    persistDraft({ step: 2, address, deliverySlot });
    goToStep(2);
  };

  const onPaymentContinue = () => {
    persistDraft({ step: 3, paymentMethod, orderNotes });
    goToStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finalizeOrder = (
    paymentStatus: "paid" | "cod",
    paymentReference?: string
  ) => {
    const order = placeOrder({
      items,
      totals,
      address: getCheckoutDraft().address,
      paymentMethod,
      paymentStatus,
      paymentReference,
      // The revalidated coupon, so the order records the discount that was
      // actually charged rather than a stale one from an earlier cart.
      coupon: validCoupon ?? undefined,
      deliverySlot,
      orderNotes: orderNotes.trim() || undefined,
    });

    if (validCoupon) {
      recordCouponUsage(validCoupon.code);
    }

    clearCart();
    clearCartPreferences();
    clearCheckoutDraft();
    setPlacing(false);

    toast.success("Order placed!", {
      description: `Order ${order.orderNumber} confirmed`,
    });

    // The customer who just placed this order can view it without going
    // through the track-order lookup.
    grantOrderAccess(order.orderNumber);
    router.push(`${routes.store.orderSuccess}?order=${order.orderNumber}`);
  };

  const onPlaceOrder = async () => {
    if (commerce.minOrderValue > 0 && totals.subtotal < commerce.minOrderValue) {
      toast.error(`Minimum order value is ${formatCurrency(commerce.minOrderValue)}`);
      return;
    }

    const address = getCheckoutDraft().address;

    // Online payment — open the Razorpay modal, place the order only once verified.
    if (paymentMethod === "razorpay") {
      setPlacing(true);
      setPayUI({ state: "redirecting" });
      try {
        const result = await openRazorpayCheckout({
          amount: totals.total,
          receipt: `bk-${Date.now()}`,
          name: address.fullName,
          email: address.email,
          phone: address.phone,
        });
        setPayUI({ state: "processing" });
        finalizeOrder("paid", result.paymentId);
      } catch (error) {
        setPlacing(false);
        const msg = error instanceof Error ? error.message : "Payment failed";
        setPayUI({ state: /cancel/i.test(msg) ? "cancelled" : "failed", reason: msg });
      }
      return;
    }

    // Cash on Delivery
    setPlacing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    finalizeOrder("cod", undefined);
  };

  const retryPayment = () => {
    setPayUI(null);
    goToStep(3);
    void onPlaceOrder();
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
      {/* Payment processing / failure overlay (solid backdrop — no glassmorphism) */}
      {payUI ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <ProcessingState
            state={payUI.state}
            reason={payUI.reason}
            className="w-full max-w-md"
            actions={
              payUI.state === "failed" || payUI.state === "cancelled"
                ? [
                    {
                      label: "Retry payment",
                      onClick: retryPayment,
                      variant: "bakery",
                      icon: "retry",
                    },
                    {
                      label: "Change method",
                      onClick: () => {
                        setPayUI(null);
                        goToStep(2);
                      },
                      variant: "outline",
                    },
                    {
                      label: "Contact support",
                      onClick: () => router.push(routes.store.contact),
                      variant: "ghost",
                    },
                  ]
                : undefined
            }
          />
        </div>
      ) : null}

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
          <CheckoutProgress
            currentStep={step}
            onStepSelect={(target) => {
              goToStep(target);
            }}
            className="mb-8"
          />

          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="order-1 space-y-6 lg:order-none lg:col-start-1">
              {step === 1 ? (
                <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                  <h2 className="font-heading text-lg font-semibold">Delivery details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Where should we deliver your order?
                  </p>

                  <form
                    className="mt-6 space-y-4"
                    onSubmit={handleSubmit(onDeliverySubmit)}
                  >
                    <DeliveryAddressPicker
                      addresses={savedAddresses}
                      selectedId={addressChoice === "new" ? null : addressChoice}
                      onSelect={(address) => {
                        setAddressChoice(address.id);
                        setEditingAddressId(null);
                        setShowAddressForm(false);
                        reset(toCheckoutAddress(address));
                      }}
                      onEdit={(address) => {
                        setAddressChoice(address.id);
                        setEditingAddressId(address.id);
                        setShowAddressForm(true);
                        reset(toCheckoutAddress(address));
                      }}
                      onAddNew={() => {
                        setAddressChoice("new");
                        setEditingAddressId(null);
                        setShowAddressForm(true);
                        const session = getCustomerSession();
                        reset({
                          ...EMPTY_CHECKOUT_ADDRESS,
                          // Keep who they are; only the destination changes.
                          fullName: session?.name ?? "",
                          email: session?.email ?? "",
                          phone: session?.phone ?? "",
                        });
                      }}
                    />


                    {showAddressForm ? (
                      <div className="space-y-4 rounded-xl border border-border bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">
                            {editingAddressId ? "Edit address" : "New delivery address"}
                          </p>
                          {savedAddresses.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setShowAddressForm(false);
                                setEditingAddressId(null);
                                const fallback =
                                  savedAddresses.find((entry) => entry.id === addressChoice) ??
                                  savedAddresses[0];
                                if (fallback) {
                                  setAddressChoice(fallback.id);
                                  reset(toCheckoutAddress(fallback));
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="fullName">Full name</Label>
                        <Input
                          id="fullName"
                          {...register("fullName", { required: "Name is required" })}
                        />
                        {formState.errors.fullName ? (
                          <p role="alert" className="text-xs text-destructive">
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
                          <p role="alert" className="text-xs text-destructive">
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
                          <p role="alert" className="text-xs text-destructive">
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
                          <p role="alert" className="text-xs text-destructive">
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
                        {formState.errors.city ? (
                          <p role="alert" className="text-xs text-destructive">
                            {formState.errors.city.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          {...register("state", { required: "State is required" })}
                        />
                        {formState.errors.state ? (
                          <p role="alert" className="text-xs text-destructive">
                            {formState.errors.state.message}
                          </p>
                        ) : null}
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
                          <p role="alert" className="text-xs text-destructive">
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

                        {/* Only offered for a genuinely new destination —
                            editing an existing one already updates it. */}
                        {!editingAddressId ? (
                          <label className="flex cursor-pointer items-center gap-3 text-sm">
                            <Checkbox
                              checked={saveNewAddress}
                              onCheckedChange={(checked) => setSaveNewAddress(checked === true)}
                            />
                            Save this address for next time
                          </label>
                        ) : null}
                      </div>
                    ) : null}

                    {/* One slot for the whole order — an order is delivered
                        once, even when each cake was added separately. */}
                    <div className="space-y-3 rounded-xl border border-border bg-cream-50 p-4">
                      <div>
                        <p className="text-sm font-medium">When should we deliver?</p>
                        <p className="text-xs text-muted-foreground">
                          We bake fresh, so the earliest date depends on preparation time.
                        </p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="deliveryDate">Delivery date</Label>
                          <Input
                            id="deliveryDate"
                            type="date"
                            min={minDeliveryDate}
                            value={deliverySlot.date}
                            aria-invalid={Boolean(slotError) && !deliverySlot.date}
                            onChange={(event) => {
                              setSlotError(null);
                              setDeliverySlot((prev) => ({ ...prev, date: event.target.value }));
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="deliveryTime">Delivery time</Label>
                          <select
                            id="deliveryTime"
                            value={deliverySlot.timeSlot}
                            aria-invalid={Boolean(slotError) && !deliverySlot.timeSlot}
                            onChange={(event) => {
                              setSlotError(null);
                              setDeliverySlot((prev) => ({
                                ...prev,
                                timeSlot: event.target.value,
                              }));
                            }}
                            className="h-8 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
                          >
                            <option value="">Select a time</option>
                            {slotOptions.map((slot) => (
                              <option key={slot} value={slot}>
                                {slot}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {slotError ? (
                        <p role="alert" className="text-xs text-destructive">
                          {slotError}
                        </p>
                      ) : null}
                    </div>

                    <CartIssuesAlert issues={cartIssues} />

                    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
                      <Button variant="outline" render={<Link href={routes.store.cart} />}>
                        Back to cart
                      </Button>
                      <Button type="submit" variant="bakery" disabled={cartBlocked}>
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
                      Pay securely online, or choose Cash on Delivery.
                    </p>

                    <div className="mt-5">
                      <PaymentMethodList
                        methods={enabledMethods}
                        selected={paymentMethod}
                        onSelect={(id) => {
                          const method = id as PaymentMethod;
                          setPaymentMethod(method);
                          persistDraft({
                            paymentMethod: method,
                            paymentVerified: false,
                            paymentReference: undefined,
                          });
                        }}
                      />
                    </div>

                    <div className="mt-5 border-t border-border pt-5">
                      <SecurityBadges />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                    <Label htmlFor="orderNotes">Special instructions (optional)</Label>
                    <Textarea
                      id="orderNotes"
                      className="mt-2"
                      placeholder="Gate code, delivery instructions, etc."
                      value={orderNotes}
                      onChange={(event) => setOrderNotes(event.target.value)}
                    />
                  </div>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <Button variant="outline" onClick={() => goToStep(1)}>
                      Back
                    </Button>
                    <Button
                      variant="bakery"
                      onClick={onPaymentContinue}
                      disabled={availablePaymentOptions.length === 0}
                    >
                      Review order
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

                      {hasDeliverySlot(deliverySlot) ? (
                        <ReviewBlock title="Delivery slot">
                          <p className="font-medium">
                            {new Date(deliverySlot.date).toLocaleDateString("en-IN", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                          </p>
                          <p className="text-muted-foreground">{deliverySlot.timeSlot}</p>
                        </ReviewBlock>
                      ) : null}

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

                    <CartIssuesAlert issues={cartIssues} className="mt-6" />

                    {commerce.minOrderValue > 0 && totals.subtotal < commerce.minOrderValue ? (
                      <p
                        role="alert"
                        className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800"
                      >
                        Minimum order value is {formatCurrency(commerce.minOrderValue)}. Add
                        more items to continue.
                      </p>
                    ) : null}

                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                      <Button variant="outline" onClick={() => goToStep(2)}>
                        Back to payment
                      </Button>
                      <Button
                        variant="bakery"
                        onClick={onPlaceOrder}
                        disabled={
                          placing ||
                          cartBlocked ||
                          (commerce.minOrderValue > 0 && totals.subtotal < commerce.minOrderValue)
                        }
                      >
                        {placing ? <Loader2 className="size-4 animate-spin" /> : null}
                        {placing ? (
                          paymentMethod === "razorpay" ? "Processing payment…" : "Placing order…"
                        ) : paymentMethod === "razorpay" ? (
                          <>Pay {formatCurrency(totals.total)}</>
                        ) : (
                          <>Place order · {formatCurrency(totals.total)}</>
                        )}
                      </Button>
                    </div>
                  </div>

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

            <div className="order-2 space-y-4 lg:order-none lg:col-start-2 lg:sticky lg:top-24 lg:self-start">
              <OrderSummaryPanel
                items={items}
                totals={totals}
                giftWrapLabel={commerce.giftWrapLabel}
              />
              {commerce.giftWrapEnabled ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white p-4">
                  <Checkbox
                    checked={giftWrap}
                    onCheckedChange={(checked) => {
                      const next = checked === true;
                      setGiftWrap(next);
                      updateCartPreferences({ giftWrap: next });
                    }}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{commerce.giftWrapLabel}</span>
                    <span className="block text-muted-foreground">
                      Adds {formatCurrency(commerce.giftWrapFee)} to your order
                    </span>
                  </span>
                </label>
              ) : null}

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
              {!getCustomerSession() ? (
                <p className="text-center text-xs text-muted-foreground">
                  Have an account?{" "}
                  <button
                    type="button"
                    onClick={() => openCustomerAuthModal("phone")}
                    className="font-medium text-bakery-700 hover:underline"
                  >
                    Sign in
                  </button>{" "}
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
