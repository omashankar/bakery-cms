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
  type CheckoutStep,
  type DeliverySlot,
  type OrderPersonalisation,
  type PaymentMethod,
} from "@/features/orders/lib/checkout-draft";
import {
  getDeliveryTimeSlots,
  getMinDeliveryDate,
} from "@/apps/website/lib/product-details";
import type { AppliedCoupon } from "@/features/orders/lib/coupons";
import { applyCouponCode } from "@/features/orders/lib/coupons";
import { formatAddress } from "@/features/orders/lib/address-format";
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
import {
  addDays,
  earliestDeliveryDateString,
  isPastSameDayCutoff,
  isPastTimeSlot,
} from "@/features/orders/lib/delivery-date";
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
import { cn } from "@/lib/utils";

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

/**
 * Strip the address-book fields the checkout form does not carry.
 *
 * Written out key by key ON PURPOSE — a blanket spread would drag `id`,
 * `label`, `isDefault` and the timestamps into the form. The cost is that a
 * field added to `CheckoutAddress` and forgotten here compiles perfectly and
 * blanks itself the moment a returning customer taps their saved address.
 * Every optional one takes `?? ""` so an older saved record yields a string
 * rather than flipping its input to uncontrolled.
 */
function toCheckoutAddress(saved: SavedAddress): CheckoutAddress {
  return {
    fullName: saved.fullName,
    email: saved.email,
    phone: saved.phone,
    addressLine1: saved.addressLine1,
    addressLine2: saved.addressLine2 ?? "",
    landmark: saved.landmark ?? "",
    city: saved.city,
    state: saved.state,
    pincode: saved.pincode,
    country: saved.country ?? "",
    altPhone: saved.altPhone ?? "",
    addressLabel: saved.addressLabel,
  };
}

/**
 * Same delivery destination, ignoring formatting differences.
 *
 * `landmark` counts: it is the line a rider navigates by, so two addresses
 * that differ only there are not the same destination. Leaving it out made
 * SAVE look broken — the book already held a "match", so nothing was written
 * and nothing was said.
 *
 * `country`, `altPhone` and `addressLabel` do NOT count. None of them changes
 * where the parcel goes, and treating a relabelled address as a new one would
 * fill the book with duplicates.
 */
function isSameAddress(a: Partial<CheckoutAddress>, b: Partial<CheckoutAddress>): boolean {
  const norm = (value?: string) => (value ?? "").trim().toLowerCase();
  return (
    norm(a.addressLine1) === norm(b.addressLine1) &&
    norm(a.addressLine2) === norm(b.addressLine2) &&
    norm(a.landmark) === norm(b.landmark) &&
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
  const [step, setStep] = useState<CheckoutStep>(1);
  const [coupon, setCoupon] = useState<AppliedCoupon | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [orderNotes, setOrderNotes] = useState("");
  /**
   * What Personalize collects, held flat and assembled on the way out.
   *
   * One object reaches the server — see `OrderPersonalisation` — but six
   * controls write to it, and a single state object would mean every
   * keystroke replacing the whole thing.
   */
  const [occasion, setOccasion] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [editingSender, setEditingSender] = useState(false);
  const [hideSender, setHideSender] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [deliverySlot, setDeliverySlot] = useState<DeliverySlot>(EMPTY_DELIVERY_SLOT);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotOptions, setSlotOptions] = useState<string[]>([]);
  /**
   * Held as an id, so the price is always the shop's.
   *
   * `deliverySlot.tierId` is where it ends up, but the slot is only written
   * on the way out of Personalize — this drives the preview while the
   * customer is still choosing.
   */
  const [deliveryTierId, setDeliveryTierId] = useState("");
  const [minDeliveryDate, setMinDeliveryDate] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  /** A saved address id, or "new" while entering one by hand. */
  const [addressChoice, setAddressChoice] = useState<string>("new");
  /** Set when editing an existing saved address rather than adding one. */
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  /** The form is only shown when adding or editing — otherwise the cards are enough. */
  const [showAddressForm, setShowAddressForm] = useState(false);
  /**
   * THE STEP COULD RENDER NEITHER A CARD NOR A FORM, and there was no way back.
   *
   * `showAddressForm` was set true only at mount, and set false again on submit.
   * `DeliveryAddressPicker` returns null on an empty book — and its "Add new"
   * button is inside that early return, as is the form's own Cancel, which
   * renders only when a saved address exists. So a customer with NO saved
   * address who unticked "save this address" and pressed Back arrived at a step
   * with no picker, no form, and no control that could summon one: just the
   * date box and a Continue button. The typed values survived in the form state
   * and still submitted, which is worse than losing them — the address was
   * there, being sent, and could not be read or corrected.
   *
   * Derived, not stored, so the two cannot drift apart again: when there is
   * nothing to pick from, the form IS the step.
   */
  const addressFormOpen = showAddressForm || savedAddresses.length === 0;
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
    setValue,
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

    /**
     * `reset` REPLACES the value set, so this literal is the whole form — a
     * field left out of it is blank on the screen while the draft still holds
     * it, and the next Continue writes that blank back over the good value.
     * `defaultValues` does not save you here.
     */
    reset({
      fullName: draft.address.fullName || session?.name || "",
      email: draft.address.email || session?.email || "",
      phone: draft.address.phone || session?.phone || "",
      addressLine1: draft.address.addressLine1,
      addressLine2: draft.address.addressLine2,
      landmark: draft.address.landmark,
      city: draft.address.city,
      state: draft.address.state,
      pincode: draft.address.pincode,
      country: draft.address.country,
      altPhone: draft.address.altPhone,
      addressLabel: draft.address.addressLabel,
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
    // "Nothing to choose from: go straight to the form" stood here, and it was
    // the ONLY thing opening the form for a first-time customer — once, at
    // mount, never again. `addressFormOpen` derives that from the book itself,
    // so it now holds on every render including the one after Back.

    setItems(cartItems);
    setDeliverySlot(draft.deliverySlot ?? EMPTY_DELIVERY_SLOT);
    setDeliveryTierId(draft.deliverySlot?.tierId ?? "");
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

    /**
     * The sender defaults to whoever is signed in, which is true often
     * enough to save typing and never asserted as fact — the EDIT button
     * is there because the person paying is not always the person named.
     */
    const saved = draft.personalisation;
    setOccasion(saved?.occasion ?? "");
    setGiftMessage(saved?.message ?? "");
    setSenderName(saved?.sender?.name ?? session?.name ?? "");
    setSenderPhone(saved?.sender?.phone ?? session?.phone ?? "");
    setHideSender(Boolean(saved?.sender?.hideFromRecipient));
    setTermsAccepted(Boolean(saved?.termsAcceptedAt));

    const enabledMethods = paymentOptions.filter(
      (option) => loadedCommerce.paymentMethods[option.value]
    );
    const initialMethod = enabledMethods.some((option) => option.value === draft.paymentMethod)
      ? draft.paymentMethod
      : enabledMethods[0]?.value ?? "cod";
    setPaymentMethod(initialMethod);

    /**
     * ?step=2 and ?step=3 are deep links into Personalize and Payment.
     *
     * Honoured only when the draft already holds what that screen stands on:
     * Personalize needs somewhere to deliver to, and Payment needs a booked
     * slot as well. Otherwise a URL on its own skips a screen — and on the
     * last one that means taking money for an order with no date on it.
     */
    const stepParam = searchParams.get("step");
    const deliverable = hasDeliverableAddress(draft.address);
    if (stepParam === "2" && deliverable) {
      setStep(2);
    }
    if (stepParam === "3" && deliverable && hasDeliverySlot(draft.deliverySlot)) {
      setStep(3);
    }

    setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [reset, router, searchParams]);

  /** Moves between steps and records it in history, so Back walks the flow. */
  function goToStep(next: CheckoutStep) {
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
    const target: CheckoutStep = param === 2 || param === 3 ? param : 1;
    if (target === step) return;
    // Never land on a later step without what it stands on: an address to
    // deliver to, and — for Payment — a slot to deliver in.
    const draft = getCheckoutDraft();
    if (target > 1 && !hasDeliverableAddress(draft.address)) return;
    if (target === 3 && !hasDeliverySlot(draft.deliverySlot)) return;
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
  // The 3-up control is not an <input>, so its value is watched rather than
  // registered; `setValue` is what writes the choice back into the form.
  const watchedAddressLabel = watch("addressLabel");

  /**
   * THE SHOP'S OWN WORDS, not Birthday / Anniversary / Other.
   *
   * A fixed list is a claim about what this shop sells and who for. These
   * are the occasions the shop has actually tagged its products with, so a
   * florist offers what a florist tagged — and a shop that has tagged
   * nothing is asked nothing, because an empty row of buttons is worse than
   * no row at all.
   */
  /**
   * The speeds this shop sells, and the one chosen.
   *
   * A shop with none configured gets exactly what it had before tiers
   * existed: the flat window list, one delivery charge, nothing to pick.
   */
  const deliveryTiers = commerce.deliveryTiers ?? [];
  const chosenTier = deliveryTiers.find((tier) => tier.id === deliveryTierId);
  /**
   * Windows come from the chosen tier when it has any.
   *
   * A tier with none takes no window at all — a midnight or a next-day
   * delivery has nothing to choose — and offering the shop-wide list there
   * would let a customer book 4pm on a service that does not run at 4pm.
   */
  const windowsForTier = chosenTier ? chosenTier.windows : slotOptions;

  const occasionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const product of catalog) {
      for (const name of product.occasions ?? []) {
        const clean = name.trim();
        if (clean) seen.set(clean.toLowerCase(), clean);
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [catalog]);

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
        deliveryTierId,
        deliveryAddress: {
          city: watchedCity,
          pincode: watchedPincode,
        },
        commerceOverride: commerce,
      }),
    [items, validCoupon, giftWrap, deliveryTierId, watchedCity, watchedPincode, commerce]
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

    // Calendar arithmetic, not Date arithmetic. The first version built a LOCAL
    // midnight and read it back through `toISOString()`, which is UTC — so in
    // IST the floor came out a day early and the picker offered exactly the date
    // the server refuses, with the refusal landing after the card was charged.
    const zoneFloor =
      typeof zoneDays === "number" && zoneDays > 0
        ? earliestDeliveryDateString(zoneDays)
        : minDeliveryDate;
    const floor = zoneFloor > minDeliveryDate ? zoneFloor : minDeliveryDate;

    /**
     * And past the shop own closing time for today.
     *
     * `sameDayCutoff` drove a countdown on the product page and nothing else,
     * so a shop that closes at 2pm went on offering today at 11pm. The quote
     * refuses that now; this is so the customer is never offered it.
     */
    return isPastSameDayCutoff(floor, commerce.sameDayCutoff)
      ? addDays(floor, 1)
      : floor;
  }, [totals.deliveryMinDays, minDeliveryDate, commerce.sameDayCutoff]);

  // Anything that changes the price invalidates the shop's last answer.
  useEffect(() => {
    setServerTotals(null);
    setServerItems(null);
  }, [items, validCoupon, giftWrap, deliveryTierId, watchedCity, watchedPincode]);

  function persistDraft(
    patch: Partial<{
      step: CheckoutStep;
      address: CheckoutAddress;
      personalisation?: OrderPersonalisation;
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

  /**
   * Writes the destination to the address book, and goes nowhere.
   *
   * This used to be the first half of the step's submit, so the only way to
   * keep an address was to leave the screen — and whether it was kept at all
   * was decided by a checkbox the customer had to notice before pressing
   * Continue. Now SAVE saves and Continue continues, which is what the two
   * words mean.
   *
   * Still best-effort: keeping the book current is a convenience and must
   * never be the reason an order cannot be placed.
   */
  const saveAddressToBook = (address: CheckoutAddress) => {
    try {
      if (editingAddressId) {
        updateSavedAddress(editingAddressId, {
          ...address,
          // Deliberate overwrite. Editing used to pass no `label` at all, so
          // the old one survived — which meant re-labelling an address from
          // Home to Office changed nothing anybody could see.
          label: address.addressLabel ?? "Home",
        });
        setSavedAddresses(getSavedAddresses());
        toast.success("Address updated");
        return;
      }

      const alreadySaved = savedAddresses.some((entry) => isSameAddress(entry, address));
      if (alreadySaved) {
        // Silent before, and pressing a button that does nothing and says
        // nothing reads as broken.
        toast.info("That address is already in your address book");
        return;
      }

      const created = createSavedAddress({
        ...address,
        // The customer's own word for it. This was `address.city`, so someone
        // who chose Home got a card titled "Kota".
        label: address.addressLabel ?? "Home",
        isDefault: savedAddresses.length === 0,
      });
      setSavedAddresses(getSavedAddresses());
      setAddressChoice(created.id);
      toast.success("Address saved for next time");
    } catch {
      // Ignore — the order still goes through with the address as typed.
    }
  };

  const onDeliverySubmit = (address: CheckoutAddress) => {
    setShowAddressForm(false);
    setEditingAddressId(null);

    // The slot is asked for on the next screen now, so it is not this one's
    // to persist — writing it here would stamp an empty slot over one the
    // customer had already chosen and come back from.
    persistDraft({ step: 2, address });
    goToStep(2);
  };

  /**
   * What Personalize collected, or nothing at all.
   *
   * Undefined rather than an object of empty strings: a shop reading an
   * order should be able to tell "they chose nothing" from "they chose
   * blank", and every read-back downstream tests for presence.
   */
  function collectPersonalisation(): OrderPersonalisation | undefined {
    const sender =
      senderName.trim() || senderPhone.trim()
        ? {
            name: senderName.trim(),
            phone: senderPhone.trim(),
            hideFromRecipient: hideSender || undefined,
          }
        : undefined;

    const value: OrderPersonalisation = {
      occasion: occasion.trim() || undefined,
      message: giftMessage.trim() || undefined,
      sender,
      termsAcceptedAt: termsAccepted ? new Date().toISOString() : undefined,
    };

    return Object.values(value).some(Boolean) ? value : undefined;
  }

  /** Leaving Personalize: the slot is what this screen exists to collect. */
  const onPersonalizeContinue = () => {
    /**
     * The LABEL is stamped here, beside the id.
     *
     * An id alone cannot name the service on an order the shop reads back
     * next month, after the tier has been renamed or deleted. The fee is
     * deliberately not stamped: that is looked up from settings every time
     * the cart is priced, so a browser can never name its own surcharge.
     */
    const slotWithTier: DeliverySlot = {
      ...deliverySlot,
      tierId: chosenTier?.id,
      tierLabel: chosenTier?.label,
    };

    if (!slotWithTier.date?.trim()) {
      setSlotError("Choose a delivery date");
      return;
    }

    /**
     * The window is required only where one exists to pick.
     *
     * `hasDeliverySlot` cannot decide this: it is handed a stored slot with no
     * settings in reach, so it answers the guard-level question — has a
     * delivery been booked at all. Whether THIS speed needs a window is known
     * here, where the tier is in hand.
     */
    const needsWindow = deliveryTiers.length > 0 ? windowsForTier.length > 0 : true;
    if (needsWindow && !slotWithTier.timeSlot?.trim()) {
      setSlotError(
        deliveryTiers.length > 0
          ? "Choose a delivery time for this option"
          : "Choose a delivery date and time",
      );
      return;
    }
    setSlotError(null);
    persistDraft({
      step: 3,
      deliverySlot: slotWithTier,
      paymentMethod,
      personalisation: collectPersonalisation(),
    });
    goToStep(3);
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
      personalisation: collectPersonalisation(),
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
        toast.error("The store could not accept this order", {
          description: `${refusal} Please contact support with the reference shown — your payment is safe.`,
          duration: 15000,
        });
        return;
      }

      toast.error("Still couldn't reach the store", {
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
      deliveryTierId: deliveryTierId || undefined,
      deliveryAddress: { city: address.city, pincode: address.pincode },
      // The whole order intent, so the webhook can finish this order from the
      // draft if the customer's browser never comes back from the gateway.
      address,
      deliverySlot,
      orderNotes: orderNotes.trim() || undefined,
      personalisation: collectPersonalisation(),
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
        description: `The store did not accept this code, so it has been removed. This order comes to ${formatCurrency(quote.totals.total)}.`,
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
        The order reached this browser but not the store. Shown INSTEAD of the
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
                  ? "Your payment went through, but we couldn't reach the store to confirm the order. Nothing has been lost — please retry."
                  : "We couldn't reach the store to confirm your order. Your cart is still here — please retry."
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
                        // Payment, which is step 3 now — 2 is Personalize, and
                        // sending someone to re-pick a date they had already
                        // chosen is not what "Change method" offers.
                        goToStep(3);
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
                  {/*
                    "Delivery details" covered two questions — where, and when —
                    and only one of them is still asked here. The when moved to
                    Personalize, so this says the one thing it now does.
                  */}
                  <h2 className="font-heading text-lg font-semibold">Delivery address</h2>
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


                    {addressFormOpen ? (
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
                      <div className="space-y-2">
                        {/*
                          No validation beyond a length cap. A second number is
                          a courtesy — refusing the order because the spare one
                          is short would be the field costing more than it is
                          worth.
                        */}
                        <Label htmlFor="altPhone">Alternate phone (optional)</Label>
                        <Input id="altPhone" type="tel" {...register("altPhone")} />
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
                      <div className="space-y-2 sm:col-span-2">
                        {/*
                          Its own field, not a second address line. "Flat 4B"
                          continues the address; "opposite the water tank" is
                          how somebody finds the door. The rider's message
                          carries this one.
                        */}
                        <Label htmlFor="landmark">Landmark (optional)</Label>
                        <Input
                          id="landmark"
                          placeholder="A shop, a turning, anything easy to spot"
                          {...register("landmark")}
                        />
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
                      <div className="space-y-2">
                        {/*
                          A TYPED FIELD, not a dropdown.

                          Nothing in this CMS records which country the shop is
                          in — no setting, no list anywhere in the repo — so a
                          select offering one country would be this code making
                          a claim on the shop's behalf, and a select offering
                          every country is a list nobody asked for.
                        */}
                        <Label htmlFor="country">Country (optional)</Label>
                        <Input id="country" {...register("country")} />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label>Save this as</Label>
                        {/*
                          What the customer calls the place. It used to be the
                          city name, stamped on without asking — so somebody
                          who meant "Office" got a card headed "Kota", and the
                          two addresses they keep at the same city were
                          impossible to tell apart in the list.

                          Radios, not buttons: this is one choice out of three,
                          and a keyboard or a screen reader should be able to
                          arrow through it.
                        */}
                        <div
                          role="radiogroup"
                          aria-label="Save this as"
                          className="grid grid-cols-3 gap-2"
                        >
                          {(["Home", "Office", "Other"] as const).map((option) => {
                            const active = watchedAddressLabel === option;
                            return (
                              <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setValue("addressLabel", option)}
                                className={cn(
                                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                                  active
                                    ? "border-bakery-700 bg-bakery-700 text-white"
                                    : "border-border bg-white text-foreground hover:border-bakery-700"
                                )}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                        {/*
                          "Save this address for next time" stood here, ticked
                          by default, and it was the only thing deciding
                          whether Continue also wrote to the address book. A
                          button that says SAVE decides that now — a customer
                          who wants to keep an address presses it, and one who
                          does not, does not.

                          CANCEL only appears when there is a card to fall back
                          to. With an empty book the form IS the step, and a
                          Cancel that can close it leads nowhere.
                        */}
                        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                          {savedAddresses.length > 0 ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="sm:min-w-32"
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
                          {/*
                            type="button", and validated by hand.

                            The form's onSubmit carries the customer to
                            Personalize, so a default <button> here would save
                            the address AND leave the screen — the one thing
                            splitting these two apart was meant to stop.
                            `handleSubmit(fn)()` runs the same validation the
                            step does, so SAVE cannot write a half-typed
                            destination into the book.
                          */}
                          <Button
                            type="button"
                            variant="secondary"
                            className="sm:min-w-32"
                            onClick={() => void handleSubmit(saveAddressToBook)()}
                          >
                            {editingAddressId ? "Save changes" : "Save address"}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <CartIssuesAlert issues={cartIssues} />

                    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
                      <Button variant="outline" render={<Link href={routes.store.cart} />}>
                        Back to cart
                      </Button>
                      <Button type="submit" variant="bakery" disabled={cartBlocked}>
                        Continue
                      </Button>
                    </div>
                  </form>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                    <h2 className="font-heading text-lg font-semibold">Personalize your order</h2>

                    <div className="mt-5 space-y-4">
                      {deliveryTiers.length > 0 ? (
                        <div className="space-y-2">
                          <Label>How fast</Label>
                          {/*
                            The shop's own speeds and the shop's own prices.
                            A shop that has set none up never sees this block,
                            and gets the one delivery charge it always had.
                          */}
                          <div role="radiogroup" aria-label="How fast" className="space-y-2">
                            {deliveryTiers.map((tier) => {
                              const active = tier.id === deliveryTierId;
                              return (
                                <button
                                  key={tier.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  onClick={() => {
                                    setSlotError(null);
                                    setDeliveryTierId(tier.id);
                                    // A window booked against the old tier
                                    // may not exist on this one, and a select
                                    // holding a value it has no option for
                                    // shows blank while still submitting.
                                    if (!tier.windows.includes(deliverySlot.timeSlot)) {
                                      setDeliverySlot((prev) => ({ ...prev, timeSlot: "" }));
                                    }
                                  }}
                                  className={cn(
                                    "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                                    active
                                      ? "border-bakery-700 bg-bakery-50"
                                      : "border-border bg-white hover:border-bakery-700"
                                  )}
                                >
                                  <span>
                                    <span className="block text-sm font-medium">{tier.label}</span>
                                    {tier.description ? (
                                      <span className="block text-xs text-muted-foreground">
                                        {tier.description}
                                      </span>
                                    ) : null}
                                  </span>
                                  {/*
                                    A free tier says Free rather than a
                                    zero-rupee amount, the same way the
                                    Delivery row does.
                                  */}
                                  <span className="shrink-0 text-sm font-semibold">
                                    {tier.fee > 0 ? `+${formatCurrency(tier.fee)}` : "Free"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                  {/* One slot for the whole order — an order is delivered
                      once, even when each cake was added separately. */}
                  <div className="space-y-3 rounded-xl border border-border bg-cream-50 p-4">
                    <div>
                      <p className="text-sm font-medium">When should we deliver?</p>
                      <p className="text-xs text-muted-foreground">
                        The earliest date depends on preparation time.
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
                      {/*
                        Hidden when the chosen speed has no windows — a
                        midnight or a next-day delivery has nothing to pick,
                        and an empty dropdown labelled "Delivery time" reads
                        as a list that failed to load.
                      */}
                      {windowsForTier.length > 0 ? (
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
                          {/*
                            Today windows that have already closed are not
                            offered — the quote refuses them. The one already
                            chosen stays listed whatever the clock says, so the
                            select never renders a value it has no option for;
                            changing the date is what clears it.
                          */}
                          {windowsForTier
                            .filter(
                              (slot) =>
                                slot === deliverySlot.timeSlot ||
                                !isPastTimeSlot(deliverySlot.date, slot),
                            )
                            .map((slot) => (
                              <option key={slot} value={slot}>
                                {slot}
                              </option>
                            ))}
                        </select>
                      </div>
                      ) : null}
                    </div>
                    {slotError ? (
                      <p role="alert" className="text-xs text-destructive">
                        {slotError}
                      </p>
                    ) : null}
                  </div>
                      {occasionOptions.length > 0 ? (
                        <div className="space-y-2">
                          <Label>Occasion (optional)</Label>
                          {/*
                            The shop's own words. A shop that has tagged no
                            occasions is not asked — this whole block is gone,
                            rather than showing an empty row of buttons.
                          */}
                          <div role="radiogroup" aria-label="Occasion" className="flex flex-wrap gap-2">
                            {occasionOptions.map((option) => {
                              const active = occasion === option;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  // Pressing the chosen one again clears it:
                                  // the field is optional, and a control with
                                  // no way back is not.
                                  onClick={() => setOccasion(active ? "" : option)}
                                  className={cn(
                                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                                    active
                                      ? "border-bakery-700 bg-bakery-700 text-white"
                                      : "border-border bg-white text-foreground hover:border-bakery-700"
                                  )}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        {/*
                          For whoever opens the parcel — NOT the same box as
                          "Special instructions" on the payment step, which is
                          for the shop, and not the per-item message, which is
                          printed on the thing itself. Three messages sounds
                          like two too many until you need to tell a rider
                          about a gate code without it appearing on a gift.
                        */}
                        <Label htmlFor="giftMessage">Message for the recipient (optional)</Label>
                        <Textarea
                          id="giftMessage"
                          rows={3}
                          maxLength={500}
                          value={giftMessage}
                          onChange={(event) => setGiftMessage(event.target.value)}
                        />
                      </div>

                      <div className="space-y-3 rounded-xl border border-border bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Who it is from</p>
                            <p className="text-xs text-muted-foreground">
                              We will use these to reach you about this order.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingSender((open) => !open)}
                          >
                            {editingSender ? "Done" : "Edit"}
                          </Button>
                        </div>

                        {/*
                          Filled in from the signed-in account and shown as
                          text until asked otherwise. The person paying is not
                          always the person named, so EDIT exists — but a
                          checkout that opens with two more empty boxes reads
                          as two more things to do.
                        */}
                        {editingSender ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="senderName">Name</Label>
                              <Input
                                id="senderName"
                                value={senderName}
                                onChange={(event) => setSenderName(event.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="senderPhone">Phone</Label>
                              <Input
                                id="senderPhone"
                                type="tel"
                                value={senderPhone}
                                onChange={(event) => setSenderPhone(event.target.value)}
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm">
                            {[senderName, senderPhone].filter(Boolean).join(" · ") || (
                              <span className="text-muted-foreground">Not set</span>
                            )}
                          </p>
                        )}

                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <Checkbox
                            checked={hideSender}
                            onCheckedChange={(checked) => setHideSender(checked === true)}
                          />
                          <span>
                            Keep it a surprise
                            <span className="block text-xs text-muted-foreground">
                              Your name and number stay off what the recipient sees. The
                              shop still has them, because it has to be able to reach you.
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <Button variant="outline" onClick={() => goToStep(1)}>
                      Back
                    </Button>
                    <Button
                      variant="bakery"
                      onClick={onPersonalizeContinue}
                      disabled={cartBlocked}
                    >
                      Continue to payment
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
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
                      // Persisted on blur because this box no longer has a
                      // screen to leave: the step that used to write it away on
                      // its way to Review is the step the order is placed from.
                      onBlur={(event) => persistDraft({ orderNotes: event.target.value })}
                    />
                  </div>

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
                          {formatAddress(getCheckoutDraft().address)}
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

                    {/*
                      A CONTROL, not a caption.

                      This was a centred grey sentence saying agreement had
                      already happened by virtue of pressing the button beside it.
                      Nothing was ticked and nothing was recorded, so the shop had
                      no way to say when — or whether — its terms were accepted on
                      any given order.

                      It is unticked to begin with, deliberately. A pre-ticked
                      consent box records the same nothing the sentence did, and
                      the order stores the moment it was ticked rather than the
                      fact that a page once contained the words.
                    */}
                    <label className="flex cursor-pointer items-start justify-center gap-3 text-xs text-muted-foreground">
                      <Checkbox
                        checked={termsAccepted}
                        onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                      />
                      <span>
                        {commerce.checkoutTerms || (
                          <>
                            I agree to the{" "}
                            <Link
                              href={routes.store.terms}
                              className="text-bakery-700 hover:underline"
                            >
                              Terms of Service
                            </Link>
                            .
                          </>
                        )}
                      </span>
                    </label>

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
                          // The tick above means something now, so it gates the
                          // button. `title` because a disabled control that
                          // does not say why is the worst kind.
                          !termsAccepted ||
                          (commerce.minOrderValue > 0 && totals.subtotal < commerce.minOrderValue)
                        }
                        title={!termsAccepted ? "Accept the terms above to continue" : undefined}
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
