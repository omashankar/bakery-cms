/**
 * What each transactional email actually supplies to its template.
 *
 * ONE source of truth, because there were two and they disagreed.
 *
 * The admin's editor offers "insert variable" chips built from
 * `COMMON_TEMPLATE_VARIABLES` — every variable any template might use — with no
 * regard for which template is open. So an admin editing the password-reset
 * email could insert `{{order_total}}`, see it render in the preview (the
 * preview fills every variable with sample data), save it, and the next customer
 * to reset their password received the literal text `{{order_total}}`.
 * `renderTemplate` leaves an unresolved key exactly as written, so nothing
 * anywhere flagged it.
 *
 * These lists are what the server-side senders pass. A test asserts
 * the two agree, so adding a variable to a template without supplying it — or
 * dropping one a template relies on — fails rather than reaching an inbox.
 *
 * `store_name`, `store_phone` and `store_email` are merged into every send by
 * `storeIdentity()`, so they are always available and appear in each list.
 */
export const STORE_VARIABLES = ["store_name", "store_phone", "store_email"] as const;

export const TEMPLATE_VARIABLE_CONTRACT: Record<string, readonly string[]> = {
  order_confirmation: [
    ...STORE_VARIABLES,
    "customer_name",
    "order_number",
    "order_total",
    "payment_method",
    "delivery_date",
    "invoice_url",
  ],
  order_shipped: [
    ...STORE_VARIABLES,
    "customer_name",
    "order_number",
    "delivery_date",
    "delivery_address",
  ],
  /**
   * The one status change a customer is never glad to read, and was never told.
   *
   * Cancelling wrote a status, put the stock back and released the coupon, and
   * sent nothing. A customer whose order was cancelled found out by it never
   * arriving — and if they had paid, their money was still sitting in the
   * gateway with nothing anywhere saying so.
   *
   * `refund_note` is what makes this honest rather than merely polite: whether
   * money is coming back depends on whether any was taken, and that is the first
   * thing they will want to know.
   */
  order_cancelled: [
    ...STORE_VARIABLES,
    "customer_name",
    "order_number",
    "order_total",
    "refund_note",
  ],
  invoice: [
    ...STORE_VARIABLES,
    "customer_name",
    "order_number",
    "order_total",
    "order_date",
    "invoice_url",
  ],
  password_reset: [...STORE_VARIABLES, "customer_name", "reset_code", "expires_in"],
  /**
   * The storefront's own sign-in code. Its own variable name rather than
   * reusing `reset_code`: an admin wording one of these should not have to
   * work out which flow the word "reset" belongs to, and the two emails say
   * different things to different people.
   */
  customer_sign_in: [...STORE_VARIABLES, "customer_name", "sign_in_code", "expires_in"],
  refund_processed: [
    ...STORE_VARIABLES,
    "customer_name",
    "order_number",
    "refund_amount",
    "refund_eta",
    "refund_reference",
  ],
  admin_new_order: [
    ...STORE_VARIABLES,
    "order_number",
    "order_total",
    "customer_name",
    "customer_phone",
    "payment_method",
    "delivery_date",
    "delivery_address",
    "order_items",
    "admin_url",
  ],
};

/**
 * The same contract for WhatsApp, which is a different set for a real reason.
 *
 * A WhatsApp template is approved by Meta as fixed wording with POSITIONAL
 * placeholders, and every parameter costs a slot in that approved text. So these
 * lists are shorter than their email counterparts and deliberately carry no
 * URLs: a link inside a template body has to be approved with it, and a template
 * whose body ends in a bare `{{5}}` URL is routinely rejected.
 *
 * `store_name`/`store_phone`/`store_email` are merged in by the sender here too.
 */
export const WHATSAPP_VARIABLE_CONTRACT: Record<string, readonly string[]> = {
  order_confirmation: [
    ...STORE_VARIABLES,
    "customer_name",
    "order_number",
    "order_total",
    "delivery_date",
  ],
  order_ready: [...STORE_VARIABLES, "customer_name", "order_number"],
  delivery_update: [
    ...STORE_VARIABLES,
    "customer_name",
    "order_number",
    "delivery_address",
  ],
};

export type TemplateChannel = "email" | "whatsapp";

export function contractFor(channel: TemplateChannel): Record<string, readonly string[]> {
  return channel === "whatsapp" ? WHATSAPP_VARIABLE_CONTRACT : TEMPLATE_VARIABLE_CONTRACT;
}

/**
 * True when something in this codebase actually sends this slug.
 *
 * Channel-aware because the two disagree, and defaulting to email would be the
 * wrong answer on the WhatsApp screen rather than merely a missing one: `invoice`
 * is wired for email and not for WhatsApp, and `order_ready` the other way
 * round. A shared lookup would lock the wrong slugs and offer variables no
 * sender supplies — the exact failure this file was written to end.
 */
export function isSendableSlug(slug: string, channel: TemplateChannel = "email"): boolean {
  return slug in contractFor(channel);
}

/**
 * The variables an admin may safely insert into this template.
 *
 * For a slug with a sender, that is exactly what the sender supplies — offering
 * anything else is offering a literal `{{…}}` in a customer's inbox. For a
 * custom template nothing sends, there is no contract to honour, so its own
 * declared variables are all there is to go on.
 */
export function availableVariablesFor(
  slug: string,
  declared: readonly string[],
  channel: TemplateChannel = "email",
): string[] {
  const contract = contractFor(channel)[slug];
  if (contract) return [...contract];
  return [...new Set(declared)];
}

/**
 * Variables a template declares that its sender will never supply.
 *
 * The contract stopped the editor OFFERING a wrong variable and stopped
 * nothing else. An admin can still type `{{invoice_url}}` into the
 * out-for-delivery email, and every surface then agrees it is fine: the live
 * preview renders a real URL, and so does the test send to the admin's own
 * inbox, because both fill from one flat table of sample data that contains
 * every variable any template might use. The customer receives the literal
 * text `{{invoice_url}}` — `renderTemplate` leaves an unresolved key exactly as
 * written, and the send passes only what the contract lists.
 *
 * So the three surfaces have to ask the same question, and this is it. Empty
 * for a slug nothing sends: a custom template has no contract to break.
 */
export function offContractVariables(
  slug: string,
  declared: readonly string[],
  channel: TemplateChannel = "email",
): string[] {
  const contract = contractFor(channel)[slug];
  if (!contract) return [];

  const allowed = new Set(contract);
  return [...new Set(declared)].filter((variable) => !allowed.has(variable));
}

/** The shape a slug must have to be a usable key. */
const SLUG_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

export interface SlugProblem {
  message: string;
  /** True when the slug cannot be changed at all, not merely corrected. */
  locked: boolean;
}

/**
 * Why this slug cannot be used, or `null` if it can.
 *
 * The slug is not a label — it is the KEY a sender matches on. `findTemplate`
 * takes the first ACTIVE template whose slug matches, so three things could go
 * wrong and none of them were checked:
 *
 *  - Free text with no format rule: " Order_Confirmation " never matches
 *    anything, and the admin's carefully edited copy silently stops being used
 *    while the hardcoded fallback goes out instead.
 *  - No uniqueness: two active templates claiming `order_confirmation` means
 *    whichever happens to be first in the list wins. An admin could add a
 *    template and quietly take over the shop's real order confirmation.
 *  - Renaming a wired slug: the same silent fallback, with nothing on screen to
 *    say the email an admin just spent ten minutes wording is no longer the one
 *    customers receive.
 *
 * A wired slug is therefore locked. Everything else must at least be well
 * formed and unique.
 */
export function validateSlug(
  slug: string,
  originalSlug: string,
  otherSlugs: readonly string[],
  channel: TemplateChannel = "email",
): SlugProblem | null {
  const trimmed = slug.trim();
  const noun = channel === "whatsapp" ? "WhatsApp message" : "email";

  if (isSendableSlug(originalSlug, channel) && trimmed !== originalSlug) {
    return {
      message: `"${originalSlug}" is the key this ${noun} is sent by — renaming it would stop customers receiving your version.`,
      locked: true,
    };
  }

  if (!trimmed) return { message: "A slug is required.", locked: false };

  if (!SLUG_PATTERN.test(trimmed)) {
    return {
      message: "Use lowercase letters, numbers and underscores — for example order_confirmation.",
      locked: false,
    };
  }

  if (otherSlugs.includes(trimmed)) {
    return {
      message: "Another template already uses this slug. Sending picks one of them at random.",
      locked: false,
    };
  }

  // Taking over a slug the shop actually sends, from a template that did not
  // previously own it, is the hijack case.
  if (isSendableSlug(trimmed, channel) && !isSendableSlug(originalSlug, channel)) {
    return {
      message: `"${trimmed}" is reserved for the ${noun} the shop already sends. Choose another slug.`,
      locked: false,
    };
  }

  return null;
}
