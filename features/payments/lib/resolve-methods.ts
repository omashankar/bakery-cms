import {
  CHECKOUT_METHODS,
  type CheckoutMethod,
} from "@/features/payments/registry/methods";
import { getCommerceSettings } from "@/features/admin/settings/lib/settings-repository";
import type { PaymentMethodSettings } from "@/types/settings";

/**
 * Returns the payment methods a customer should see, based on which ones the
 * admin has enabled in commerce settings. Sorted by priority (recommended first).
 * Backend-ready: swap the settings source later without touching the checkout UI.
 */
export function getEnabledCheckoutMethods(): CheckoutMethod[] {
  const enabled = getCommerceSettings().paymentMethods as PaymentMethodSettings;
  return CHECKOUT_METHODS.filter(
    (method) => enabled[method.id as keyof PaymentMethodSettings]
  ).sort((a, b) => a.priority - b.priority);
}
