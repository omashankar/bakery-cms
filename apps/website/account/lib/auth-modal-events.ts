/**
 * Opening the customer sign-in modal, without importing it.
 *
 * The modal lives in the navbar and pulls in the dialog and form primitives.
 * These two lived in its module, so the cart, checkout and order pages — and
 * the navbar's own login menu — loaded the whole modal just to be able to ask
 * for it. The navbar now loads the modal the first time it is asked for.
 */

/** Fire from anywhere to open the single customer auth modal (lives in the navbar). */
export const OPEN_AUTH_MODAL_EVENT = "bakery-open-auth-modal";

export function openCustomerAuthModal(step: "phone" | "signup" = "phone") {
  if (typeof window === "undefined") return;
  // The two names are kept for the call sites that use them; both open the same
  // flow, because with an emailed code there is no separate sign-up — the first
  // successful sign-in for an address creates the account.
  window.dispatchEvent(new CustomEvent(OPEN_AUTH_MODAL_EVENT, { detail: { step } }));
}
