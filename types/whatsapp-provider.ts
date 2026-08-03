/**
 * The WhatsApp Business Cloud API connection.
 *
 * Meta's own API rather than a reseller: it is free, official, and needs no
 * third-party account. A BSP (Gupshup, MSG91, Interakt) can be added later
 * behind the same `sendWhatsAppTemplate` call — the template model below is
 * Meta's regardless, because every BSP is a wrapper over it.
 */
export interface WhatsAppConnection {
  /** Meta's id for the sending number. Not a secret; identifies the account. */
  phoneNumberId: string;
  /** The WhatsApp Business Account id, for reference in Meta's dashboard. */
  businessAccountId: string;
  /** A permanent System User token. SECRET — never leaves the server. */
  accessToken: string;
  /** Off means the templates are drafts and nothing is sent. */
  enabled: boolean;
}

/** What the browser is allowed to know: which fields are set, never the token. */
export interface WhatsAppConnectionStatus {
  configured: boolean;
  enabled: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  /**
   * True when a token is stored. The value itself is never sent.
   *
   * There is deliberately NO `accessToken` field here. This interface is the
   * shape of a response that reaches a browser, so a field for the token would
   * be a field something could fill — and a WhatsApp access token can message
   * any customer who has ever contacted the business, from the shop's verified
   * number. The presence flag is all the UI needs to render.
   */
  tokenSet: boolean;
  updatedAt: string | null;
}

/**
 * Meta approves the WORDING, and only then may it be sent.
 *
 * This is the constraint the template editor was built without. On WhatsApp a
 * business cannot send free text to a customer outside a 24-hour support
 * window — it must send a template that Meta has reviewed and approved, by
 * NAME, in a specific language, with POSITIONAL parameters (`{{1}}`, `{{2}}`)
 * rather than named ones.
 *
 * So a template row here has two halves: the copy an admin writes and previews,
 * and the Meta registration it maps onto. Without the second half the first is
 * just a document.
 */
export type WhatsAppApprovalStatus = "not_submitted" | "pending" | "approved" | "rejected";

/**
 * One template as META holds it.
 *
 * Declared here rather than beside the Graph client because the admin screen
 * renders it — and the Graph client is `server-only`, which a client component
 * must not import from even for a type. An `import type` is erased today, but it
 * is one refactor away from dragging a module holding an access token into a
 * browser bundle.
 */
export interface MetaTemplateSummary {
  name: string;
  language: string;
  status: WhatsAppApprovalStatus;
  /** The approved body text, with Meta's `{{1}}` placeholders intact. */
  body: string;
  /** How many `{{n}}` placeholders that body carries. */
  parameterCount: number;
  category: string;
}

/** What a sync against Meta found. */
export interface MetaSyncSummary {
  /** Local templates whose approval status Meta confirmed. */
  matched: { slug: string; metaName: string; approval: WhatsAppApprovalStatus }[];
  /** Linked to a Meta name that no longer exists on the business account. */
  missing: { slug: string; metaName: string }[];
  /**
   * Linked to a name Meta holds in SEVERAL languages, none of them the
   * stored one. Reported rather than resolved: picking a row would send in a
   * language the shop never chose, under an "Approved by Meta" badge.
   */
  ambiguous: { slug: string; metaName: string; languages: string[] }[];
  /** Everything Meta holds, so the editor can offer a real list to pick from. */
  available: MetaTemplateSummary[];
}

export interface WhatsAppMetaBinding {
  /** The template name registered with Meta, e.g. `order_confirmation_v1`. */
  metaName: string;
  /** BCP-47 code Meta holds it under, e.g. `en` or `en_US`. */
  metaLanguage: string;
  /**
   * Which local variable fills Meta's `{{1}}`, `{{2}}`, … in order.
   *
   * Meta has no names, only positions, so this ordering IS the mapping. Getting
   * it wrong sends the customer their delivery date where the total should be.
   */
  metaParameters: string[];
  approval: WhatsAppApprovalStatus;
}
