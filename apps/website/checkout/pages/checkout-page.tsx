"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Banknote,
  CreditCard,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCustomerSession,
  syncCustomerSession,
} from "@/apps/website/account/lib/customer-session";
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
import { calculateCartTotals, type CartTotals } from "@/features/orders/lib/cart-totals";
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
import { applyCouponCode } from "@/features/orders/lib/coupons";
import {
  hasBlockingCartIssues,
  validateCartAgainstCatalog,
} from "@/features/orders/lib/cart-validation";
import type { LandingProduct } from "@/constants/landing-data";
import { confirmOrder, placeOrder, type PlacedOrder } from "@/features/orders/lib/orders";
import {
  clearUnconfirmedOrder,
  readUnconfirmedOrder,
  saveUnconfirmedOrder,
} from "@/features/orders/lib/unconfirmed-order";
import { requestCartQuote } from "@/features/checkout/lib/quote-api";
import { grantOrderAccess } from "@/features/orders/lib/order-access";
import { earliestDeliveryDateString } from "@/features/orders/lib/delivery-date";
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
import { formatCalendarDate, formatCurrency } from "@/utils/format";
import { useBusinessLabels } from "@/hooks/use-business-labels";

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
  /**
   * The shop's name, read on the SERVER.
   *
   * This used to come from `getStorefrontBrandInfo()`, which reads the client
   * settings cache — and that cache PERSISTS the shipped seed when the storage
   * key is absent. A first-time visitor whose settings request was blocked saw
   * an unfamiliar company name heading the payment sheet at the moment they
   * entered card details, which is the failure `razorpay.ts` warns about a few
   * lines above where it reads this.
   */
  siteName: string;
}

export function CheckoutPage({ catalog, siteName }: CheckoutPageProps) {
  const labels = useBusinessLabels();
  const productLower = labels.productWord.toLowerCase();
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
        const response = await fetch("/api/razorpay/availability");
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

  /**
   * Keep the SELECTED method among the ones still on offer.
   *
   * This only ever handled one case — the Razorpay gateway turning out to have
   * no keys — and left the general one. The page starts from
   * `defaultCommerceSettings`, where every method is enabled, and pins the
   * selection to the first of them: Cash on Delivery. Hydration then brings the
   * shop's real settings, `availablePaymentOptions` re-filters and the COD
   * radio disappears from the screen — but nothing moved the selection, so an
   * ordinary first-time customer submitted `cod` to a shop that had switched it
   * off, and a COD order lands as `confirmed`: a cake the bakery is expected to
   * bake and hand over for cash it decided it would no longer take.
   *
   * Nothing to do while the list is empty — that is the pre-hydration instant,
   * not a shop that accepts no payment at all.
   */
  useEffect(() => {
    if (availablePaymentOptions.length === 0) return;
    if (availablePaymentOptions.some((option) => option.value === paymentMethod)) return;
    setPaymentMethod(availablePaymentOptions[0].value);
  }, [paymentMethod, availablePaymentOptions]);

  /**
   * This checkout has produced an order, so an emptied cart is expected.
   *
   * A ref, not state: the cart subscriber below reads it from inside a
   * subscription registered once, which would close over a stale state value.
   */
  const orderCommitted = useRef(false);
  // Online payment processing / failure overlay state.
  const [payUI, setPayUI] = useState<{ state: PaymentUIState; reason?: string } | null>(null);
  /**
   * An order that exists locally but which the server has not acknowledged. Held
   * so the customer can retry the write without paying again, and so the cart is
   * still there if they cannot.
   */
  const [unconfirmed, setUnconfirmed] = useState<{
    order: PlacedOrder;
    paymentStatus: "paid" | "cod";
    paymentReference?: string;
    /**
     * The priced cart this order was placed against.
     *
     * Held BECAUSE the retry needs it. It used to be dropped here, and the
     * retry sent the order on its own — which for anything but cash the server
     * refuses outright, permanently, because a card payment must be placed
     * against a cart the shop priced. The customer had been charged, was told
     * the bakery could not be reached, and could press Retry confirmation for
     * as long as they liked without ever getting an order.
     */
    draftId?: string;
    /**
     * The shop's own maintenance notice, when THAT is why this could not be
     * confirmed. Retrying cannot help until the shop reopens, so the overlay
     * says so and does not offer a button that would only loop.
     */
    closed?: string;
  } | null>(null);

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
    let cancelled = false;

    void (async () => {
    /**
     * A payment this browser made that the bakery never acknowledged.
     *
     * Checked FIRST, before the sign-in and empty-cart bounces, because it
     * outranks both: a customer who has been charged must see that before they
     * see anything else, whatever state the rest of the page is in. Restoring
     * it also puts the blocking overlay back, which is what stops the page from
     * quietly offering to take the money a second time.
     */
    const held = readUnconfirmedOrder();
    if (held) {
      setUnconfirmed(held);
      setReady(true);
      return;
    }

    /**
     * Ask the SERVER before bouncing anyone.
     *
     * This read the browser's cached copy, which is empty on a cold load — so
     * opening /store/checkout directly, or in a new tab, threw a signed-in
     * customer back to the cart with "Please sign in" while their session
     * cookie was perfectly valid. The cache is a render hint; only the server
     * knows.
     */
    const signedIn = await syncCustomerSession();
    if (cancelled) return;

    // Being bounced back to the cart with no explanation reads as a broken
    // button, so say why before moving them.
    if (!signedIn) {
      toast.info("Please sign in to continue to checkout");
      router.replace(routes.store.cart);
      return;
    }

    const cartItems = getCartItems();
    if (cartItems.length === 0) {
      toast.info(`Your cart is empty — add a ${productLower} to check out`);
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
    })();

    return () => {
      cancelled = true;
    };
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
        /**
         * Unless WE emptied it, one line before the success page.
         *
         * `commitPlacedOrder` clears the cart on a successful order, which
         * fires this subscriber. So at the exact moment the order went through,
         * the customer got `Your cart is now empty — add a ${productLower} to check out`
         * and a `router.replace` to the cart, racing the push to the success
         * page — a contradiction and a coin toss over where they landed.
         */
        if (orderCommitted.current) return;

        toast.info(`Your cart is now empty — add a ${productLower} to check out`);
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
  /**
   * The coupon re-checked against the cart being paid for, and WHY when it no
   * longer holds.
   *
   * The reason used to be discarded — `revalidateCoupon` returns the coupon or
   * null — so an edited cart silently lost its discount while the green
   * "SAVE20 (₹200 off)" chip stayed on screen. The totals beside it had no
   * discount line in them. Nothing said the coupon had stopped applying, and
   * nothing said what would bring it back.
   */
  const couponCheck = useMemo(
    () => (coupon ? applyCouponCode(coupon.code, subtotal) : null),
    [coupon, subtotal],
  );
  const validCoupon = couponCheck?.ok ? couponCheck.coupon : null;
  const couponLapsedReason = couponCheck && !couponCheck.ok ? couponCheck.message : null;

  /**
   * The SHOP's totals, once it has priced this cart.
   *
   * The number below is computed in the browser from a localStorage copy of the
   * commerce settings, so it can legitimately disagree with the shop — stale
   * settings, a price change, a coupon that no longer applies. It is fine as a
   * running estimate, but the customer must not be asked to pay against it: the
   * server's number is what gets charged. When they differ, this holds the
   * server's and the customer is asked to look again before committing.
   */
  const [serverTotals, setServerTotals] = useState<CartTotals | null>(null);
  /**
   * The SHOP's line prices, held alongside its totals.
   *
   * The summary priced each line from the browser's cart while the total below
   * them came from the server, so after "Prices have changed" the order summary
   * did not add up — the customer was asked to review a list whose numbers
   * contradicted the number they were being asked to pay.
   */
  const [serverItems, setServerItems] = useState<CartLineItem[] | null>(null);

  const localTotals = useMemo(
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

  const totals = serverTotals ?? localTotals;

  /**
   * The earliest date this address can actually be delivered on.
   *
   * The picker floored on the shop-wide `deliveryLeadDays` alone, so a zone the
   * admin had configured for five days happily accepted tomorrow. The zone's own
   * lead time is the stricter of the two and now moves the floor. The server
   * refuses an earlier date regardless — this is so the customer never picks one
   * only to be told no.
   */
  const earliestDeliveryDate = useMemo(() => {
    const zoneDays = totals.deliveryMinDays;
    if (typeof zoneDays !== "number" || zoneDays <= 0) return minDeliveryDate;

    // Calendar arithmetic, not Date arithmetic. The first version built a LOCAL
    // midnight and read it back through `toISOString()`, which is UTC — so in
    // IST the floor came out a day early and the picker offered exactly the date
    // the server refuses, with the refusal landing after the card was charged.
    const zoneFloor = earliestDeliveryDateString(zoneDays);
    return zoneFloor > minDeliveryDate ? zoneFloor : minDeliveryDate;
  }, [totals.deliveryMinDays, minDeliveryDate]);

  // Anything that changes the price invalidates the shop's last answer.
  useEffect(() => {
    setServerTotals(null);
    setServerItems(null);
  }, [items, validCoupon, giftWrap, watchedCity, watchedPincode]);

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

  /**
   * Commit the order once the server has it — and only then.
   *
   * The local write is a cache. An order the server never received exists in
   * this one browser and nowhere else: the customer has paid, holds a
   * confirmation number, and can even track it (the tracking page reads the same
   * cache) while the bakery never sees the order and nobody bakes the cake. So
   * nothing here is irreversible until `persisted` comes back true — the cart
   * stays full, the draft stays put, and the success page stays unvisited.
   */
  const finalizeOrder = async (
    paymentStatus: "paid" | "cod",
    paymentReference: string | undefined,
    /** The cart the SHOP priced. Its numbers are the ones that get stored. */
    draftId: string,
  ) => {
    const { order, persisted, closed } = await placeOrder({
      draftId,
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

    if (closed) {
      // The bakery is closed, not unreachable. The unconfirmed-order overlay
      // below offers a retry, and a retry cannot succeed while the shop is
      // shut — it would just send the customer round the same loop. Tell them
      // what actually happened, in the admin's own words.
      setPlacing(false);
      setPayUI(null);

      /**
       * Unless they have already been charged.
       *
       * This branch was added after the one below it and skipped what that one
       * exists for. `finalizeOrder("paid", …)` is only reached once Razorpay
       * has CAPTURED — so an admin flipping maintenance on while the modal was
       * open left a customer who had genuinely paid looking at a toast, with
       * the payment reference in scope and thrown away. It is not even lost
       * money: the webhook places the order regardless, under an order number
       * it mints itself, so the bakery holds a paid order the customer has
       * never seen the number of. The reference is the only thing that ties the
       * two together, and they need it in front of them before they navigate
       * away.
       */
      if (paymentStatus === "paid" || paymentReference) {
        const held = { order, paymentStatus, paymentReference, draftId, closed };
        setUnconfirmed(held);
        // Survives a reload. Without this the page comes back as an ordinary
        // checkout and offers to charge them again.
        saveUnconfirmedOrder(held);
        return;
      }

      toast.error("The store is closed right now", { description: closed, duration: 10000 });
      return;
    }

    if (!persisted) {
      setPlacing(false);
      // Clear the payment overlay first. It sits above the unconfirmed-order
      // overlay, so leaving it up on a failed RETRY would strand the customer
      // behind a "Verifying payment…" spinner with no way back to the button.
      setPayUI(null);
      const held = { order, paymentStatus, paymentReference, draftId };
      setUnconfirmed(held);
      saveUnconfirmedOrder(held);
      return;
    }

    commitPlacedOrder(order);
  };


  /** The steps that must happen exactly once, and only once the server has it. */
  const commitPlacedOrder = (order: PlacedOrder) => {
    orderCommitted.current = true;
    // The coupon redemption is NOT counted here.
    //
    // `placeOrder` already does it, atomically, against the code the shop itself
    // resolved — `recordCouponRedemption` in order.service. This fired a second
    // count from the browser, and it did it by PUTting the visitor's entire
    // cached coupon list to `/api/coupons`, a whole-collection replace. On a
    // browser whose cache was stale or partial that replaced the shop's coupons
    // with it, deleting every code added since that cache was filled — from a
    // customer's checkout.

    clearCart();
    clearCartPreferences();
    clearCheckoutDraft();
    setPlacing(false);
    setUnconfirmed(null);
    clearUnconfirmedOrder();
    setPayUI(null);

    toast.success("Order placed!", {
      description: `Order ${order.orderNumber} confirmed`,
    });

    // The customer who just placed this order can view it without going
    // through the track-order lookup. Their email travels with the grant so the
    // order pages can re-read the SERVER's copy later — that is what makes a
    // refund or a status change visible to them at all.
    grantOrderAccess(order.orderNumber, order.address?.email);
    router.push(`${routes.store.orderSuccess}?order=${order.orderNumber}`);
  };

  /**
   * Re-send the order the server did not acknowledge. Retries the WRITE only —
   * never the payment, which already succeeded.
   *
   * Sends the held order through `confirmOrder`, NOT back through `placeOrder`.
   * `placeOrder` would mint a new id and order number once its 15-second
   * duplicate window had lapsed — and it lapses in the ordinary case, because
   * this overlay asks the customer to note their payment reference first. Since
   * the endpoint dedupes on the id, that would have produced a second order and
   * a second stock decrement for a single payment.
   */
  const retryConfirmation = async () => {
    if (!unconfirmed || placing) return;
    setPlacing(true);

    // With the draft id from the original attempt. Without it the server has no
    // priced cart to place a card payment against and refuses — every time.
    const { order, persisted, refusal } = await confirmOrder(
      unconfirmed.order,
      unconfirmed.draftId,
    );
    setPlacing(false);

    if (!persisted) {
      // A refusal is not an outage. The server answered, and it will answer the
      // same way to the next press, so saying "couldn't reach the bakery" sends
      // the customer round a loop that cannot end. Their own words, and the
      // reference, so support can act on it.
      if (refusal) {
        toast.error("The bakery could not accept this order", {
          description: `${refusal} Please contact support with the reference shown — your payment is safe.`,
          duration: 15000,
        });
        return;
      }

      toast.error("Still couldn't reach the bakery", {
        description:
          "Your order is safe here. Try again, or contact support with the reference shown.",
      });
      return;
    }

    // `order`, not `unconfirmed.order` — the server may have had to issue a
    // different order number, and that is the one the customer must be shown.
    commitPlacedOrder(order);
  };

  const onPlaceOrder = async () => {
    if (commerce.minOrderValue > 0 && totals.subtotal < commerce.minOrderValue) {
      toast.error(`Minimum order value is ${formatCurrency(commerce.minOrderValue)}`);
      return;
    }

    const address = getCheckoutDraft().address;

    // Ask the SHOP what this cart costs, and hold on to the draft it prices.
    // Everything downstream — the amount charged and the prices stored on the
    // order — comes from that draft rather than from anything computed here.
    setPlacing(true);
    const { quote, error: quoteError } = await requestCartQuote({
      items,
      couponCode: validCoupon?.code,
      giftWrap,
      deliveryAddress: { city: address.city, pincode: address.pincode },
      // The whole order intent, so the webhook can finish this order from the
      // draft if the customer's browser never comes back from the gateway.
      address,
      deliverySlot,
      orderNotes: orderNotes.trim() || undefined,
    });

    if (!quote) {
      setPlacing(false);
      toast.error("Could not price your order", {
        description: quoteError ?? "Please refresh and try again.",
      });
      return;
    }

    /**
     * A coupon the SHOP will not honour.
     *
     * The quote has carried `rejectedCoupon` all along — its own comment says
     * "so the customer can be told" — and nothing here read it. The refused
     * code left the total higher than the browser expected, which tripped the
     * price-change branch below, so a customer whose coupon had expired or run
     * out of uses was told "Prices have changed" and shown a bigger number with
     * no explanation, while the coupon chip still said it was applied.
     *
     * Checked first, because it is the REASON for the difference the next
     * branch would otherwise report as a mystery.
     */
    if (quote.rejectedCoupon) {
      setServerTotals(quote.totals);
      setServerItems(quote.items);
      setCoupon(undefined);
      persistDraft({ coupon: undefined });
      setPlacing(false);
      toast.error(`${quote.rejectedCoupon} could not be applied`, {
        description: `The bakery did not accept this code, so it has been removed. This order comes to ${formatCurrency(quote.totals.total)}.`,
        duration: 10000,
      });
      return;
    }

    // The shop's number is the one that will be charged, so it is the one the
    // customer has to see before they commit to paying.
    if (Math.abs(quote.totals.total - totals.total) >= 0.01) {
      setServerTotals(quote.totals);
      // The lines the customer is about to re-read have to be the shop's too,
      // or the summary asks them to review a list that does not add up to the
      // number underneath it.
      setServerItems(quote.items);
      setPlacing(false);
      toast.error("Prices have changed", {
        description: `This order now comes to ${formatCurrency(quote.totals.total)}. Please review and place it again.`,
        duration: 10000,
      });
      return;
    }

    // Online payment — open the Razorpay modal, place the order only once verified.
    if (paymentMethod === "razorpay") {
      setPayUI({ state: "redirecting" });
      try {
        const result = await openRazorpayCheckout({
          draftId: quote.draftId,
          // The sheet is headed with the shop's name, not a hardcoded one.
          brandName: siteName,
          name: address.fullName,
          email: address.email,
          phone: address.phone,
        });
        setPayUI({ state: "processing" });
        await finalizeOrder("paid", result.paymentId, quote.draftId);
      } catch (error) {
        setPlacing(false);
        const msg = error instanceof Error ? error.message : "Payment failed";
        setPayUI({ state: /cancel/i.test(msg) ? "cancelled" : "failed", reason: msg });
      }
      return;
    }

    // Cash on Delivery
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await finalizeOrder("cod", undefined, quote.draftId);
    } catch (error) {
      // Without this guard a thrown placeOrder/clearCart would leave the button
      // stuck on "Placing order…" forever (finalizeOrder never resets `placing`).
      setPlacing(false);
      toast.error("Order failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
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
      {/*
        The order reached this browser but not the bakery. Shown INSTEAD of the
        success page, and it blocks: the customer needs to know their order is
        not in yet, and if they paid, they need the reference in front of them
        before they navigate away. Retry re-sends the order — never the payment.
      */}
      {unconfirmed && !payUI ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <ProcessingState
            state="failed"
            title={unconfirmed.closed ? "Your payment went through" : "Order not confirmed yet"}
            message={
              unconfirmed.closed
                ? `The shop closed while your payment was going through, so we could not confirm the order here. Your payment is safe and the bakery has it — quote the reference below when you get in touch. ${unconfirmed.closed}`
                : unconfirmed.paymentStatus === "paid"
                  ? "Your payment went through, but we couldn't reach the bakery to confirm the order. Nothing has been lost — please retry."
                  : "We couldn't reach the bakery to confirm your order. Your cart is still here — please retry."
            }
            reason={
              unconfirmed.paymentReference
                ? `Order ${unconfirmed.order.orderNumber} · payment ${unconfirmed.paymentReference}`
                : `Order ${unconfirmed.order.orderNumber}`
            }
            className="w-full max-w-md"
            actions={[
              // No retry while the shop is shut: it cannot succeed, and a
              // button that only loops is worse than no button.
              ...(unconfirmed.closed
                ? []
                : [
                    {
                      label: placing ? "Retrying…" : "Retry confirmation",
                      onClick: () => void retryConfirmation(),
                      variant: "bakery" as const,
                      icon: "retry" as const,
                    },
                  ]),
              {
                label: "Contact support",
                onClick: () => router.push(routes.store.contact),
                variant: "outline",
              },
            ]}
          />
        </div>
      ) : null}

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
                            min={earliestDeliveryDate}
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
                          {/*
                            The calendar day the customer picked, not an
                            instant. `new Date("2026-08-16")` is midnight UTC,
                            and rendering that anywhere west of UTC shows the
                            day before — so a customer confirmed a Sunday
                            delivery on a page that said Saturday, while the
                            order stored Sunday.
                          */}
                          <p className="font-medium">{formatCalendarDate(deliverySlot.date)}</p>
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
                items={serverItems ?? items}
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
                    lapsedReason={couponLapsedReason}
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
