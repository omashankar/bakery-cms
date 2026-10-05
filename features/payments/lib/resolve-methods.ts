import {
  CHECKOUT_METHODS,
  type CheckoutMethod,
} from "@/features/payments/registry/methods";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import type { PaymentMethodSettings } from "@/types/settings";

/**
 * Returns the payment methods a customer should see, based on which ones the
 * admin has enabled in commerce settings. Sorted by priority (recommended first).
 * Backend-ready: swap the settings source later without touching the checkout UI.
 */
export function getEnabledCheckoutMethods(
  /**
   * The switches to read, when the caller already holds them.
   *
   * Without this the function reaches into the settings CACHE at the moment it
   * is called — and checkout called it from a `useMemo` whose dependencies are
   * React state. If the shop's settings landed between that first render and
   * the moment the update event was subscribed to, nothing ever changed a
   * dependency, the memo kept its first answer, and the method list stayed as
   * it was when the cache was still filling.
   *
   * What the customer saw was a checkout offering cash only, on a shop whose
   * online payment was switched on and whose gateway keys were live, with no
   * error anywhere and no way to recover but a reload. Found by walking the
   * real checkout in a browser: the same journey showed Pay Online when it
   * paused for four seconds first, and did not when it went straight through.
   *
   * A caller that passes its own state gets a list that follows that state.
   */
  enabled: PaymentMethodSettings = getCommerceSettings().paymentMethods as PaymentMethodSettings,
): CheckoutMethod[] {
  return CHECKOUT_METHODS.filter(
    (method) => enabled[method.id as keyof PaymentMethodSettings]
  ).sort((a, b) => a.priority - b.priority);
}
