import type { CheckoutAddress } from "./checkout-draft";

/**
 * One way to write a delivery address down.
 *
 * There were seven copies of this join — the checkout read-back, the address
 * picker, both order-detail screens, the invoice, the account address book and
 * two server-side messages — and they did not agree with each other. Two of
 * them dropped the state entirely, and those two were the ones that go OUT: the
 * shop's new-order alert and the courier's "out for delivery" message. The rest
 * each named their own subset, so adding a field to an address meant finding
 * seven hand-written lists and getting all seven right.
 *
 * Now it means editing this file.
 */

/** Lines to print one under another. Blank fields never produce a blank line. */
export function addressLines(address: Partial<CheckoutAddress>): string[] {
  const trim = (value?: string) => value?.trim() ?? "";

  /**
   * The landmark is prefixed, not just listed.
   *
   * On its own a line reading "opposite the water tank" sits among the street
   * lines as though it were one, and a rider reads it as part of the address.
   * Saying what it is costs six characters.
   */
  const landmark = trim(address.landmark);

  return [
    trim(address.addressLine1),
    trim(address.addressLine2),
    landmark ? `Near ${landmark}` : "",
    // City, state and postcode belong on one line, the way an envelope is
    // written — and the state is here, which is what the two outbound
    // messages were missing.
    [trim(address.city), trim(address.state), trim(address.pincode)].filter(Boolean).join(", "),
    trim(address.country),
  ].filter(Boolean);
}

/** The same thing on one line, for a message or a cell that has no room. */
export function formatAddress(address: Partial<CheckoutAddress>): string {
  return addressLines(address).join(", ");
}

/**
 * Both numbers the customer left, when they left two.
 *
 * Kept out of `addressLines` on purpose: an address is where a parcel goes and
 * a phone number is how somebody is reached, and the invoice prints one of
 * those in a place the other does not belong.
 */
export function contactNumbers(address: Partial<CheckoutAddress>): string {
  const phone = address.phone?.trim() ?? "";
  const alt = address.altPhone?.trim() ?? "";
  if (!alt || alt === phone) return phone;
  return `${phone} / ${alt}`;
}
