export interface ThemeSettings {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  headingFont: string;
  borderRadius: "sm" | "md" | "lg" | "xl";
  containerWidth: "narrow" | "default" | "wide";
  headerStyle: "minimal" | "centered" | "split";
  footerStyle: "simple" | "columns" | "minimal";
  customCss?: string;
}

export interface GeneralSettings {
  siteName: string;
  siteTagline: string;
  siteDescription: string;
  logo: string;
  favicon: string;
  timezone: string;
  currency: string;
}

export interface BusinessHoursEntry {
  day: string;
  hours: string;
}

export interface ContactSettings {
  email: string;
  phone: string;
  address: string;
  mapEmbedUrl?: string;
  businessHours: BusinessHoursEntry[];
}

export interface SocialLinkSettings {
  id: string;
  platform: string;
  href: string;
  label: string;
  isActive: boolean;
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  requireStrongPasswords: boolean;
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  maxLoginAttempts: number;
}

export interface AnalyticsSettings {
  googleAnalyticsId: string;
  googleTagManagerId: string;
  facebookPixelId: string;
  hotjarId: string;
}

export interface SmtpSettings {
  host: string;
  port: number;
  username: string;
  /**
   * Write-only. The server redacts this on read, so in a browser it is either
   * blank or something the admin has just typed — and a blank one sent back
   * means "keep the stored password" rather than "clear it".
   */
  password: string;
  /**
   * Whether the SERVER holds a password, without saying what it is.
   *
   * The same shape as the payment gateway's credential status: the browser is
   * told which fields are set, never their values.
   */
  passwordSet?: boolean;
  fromEmail: string;
  fromName: string;
  encryption: "tls" | "ssl" | "none";
  enabled: boolean;
}

export interface MaintenanceSettings {
  isEnabled: boolean;
  message: string;
  allowedIps: string[];
}

export interface PaymentMethodSettings {
  cod: boolean;
  /**
   * LEGACY, and inert. Nothing switches these and nothing reads them.
   *
   * They predate Razorpay, which unified UPI, cards, netbanking and wallets
   * behind one "Pay Online" button. `setGatewayEnabled` writes only `cod` and
   * `razorpay` — the two the shop can actually collect with — so these two sit
   * at their defaults for the life of a shop and reach no customer either way.
   *
   * Kept in the shape rather than deleted because every stored settings
   * document, and every backup file an owner has taken, already carries them:
   * removing the field would make the Zod schema reject its own history. Do not
   * list them, count them, or gate anything on them — an admin screen that did
   * both told owners they had four payment methods when checkout offers two.
   */
  upi: boolean;
  card: boolean;
  /** Online payment via Razorpay (unified UPI/Card/Netbanking/Wallet checkout). */
  razorpay: boolean;
}

export interface CommerceSettings {
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minOrderValue: number;
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  taxIncludeDelivery: boolean;
  platformChargeEnabled: boolean;
  platformChargeLabel: string;
  platformChargeAmount: number;
  useZoneBasedDelivery: boolean;
  zoneFallbackDeliveryFee: number;
  deliveryLeadDays: number;
  estimatedDeliveryDays: number;
  deliveryTimeSlots: string[];
  orderNumberPrefix: string;
  checkoutTerms: string;
  giftWrapEnabled: boolean;
  giftWrapFee: number;
  giftWrapLabel: string;
  /**
   * One line under every product photo, in the shop's own words.
   *
   * "Design and icing may vary from the image shown" is the thing a shop that
   * makes each item by hand needs to say, and it is a claim only the shop can
   * make — a handmade cake varies, a sealed charger does not. Blank means
   * nothing is printed, which is the right answer for most trades.
   */
  productImageNote: string;
  /**
   * When same-day orders close, as `HH:MM` on a 24-hour clock.
   *
   * Drives the countdown under Add to Cart. Blank means the shop has not said,
   * and nothing counts down — a timer with no cutoff behind it is a pressure
   * tactic rather than information, and this is the one place on the page a
   * customer is most likely to act on what it says.
   */
  sameDayCutoff: string;
  /**
   * What the shop wants every product page to say about delivery.
   *
   * One line typed is one bullet, under a “Delivery Information” heading in
   * the product description — how it travels, what is included, what cannot
   * be promised. SHOP-WIDE rather than per product, because it is a policy:
   * the same seven lines on every cake, and retyping them per product is how
   * they come to disagree with each other.
   *
   * Blank until the shop writes it, and the heading does not render while it
   * is. This software has no delivery policy of its own to offer.
   */
  deliveryInformation: string;
  paymentMethods: PaymentMethodSettings;
}

export interface ActivityLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  userId: string;
  timestamp: string;
  details?: string;
}

/**
 * Optional bakery-specific modules. All ON by default (bakery template).
 * Turning one OFF hides that feature from the UI only — data/fields are never
 * deleted, so switching back ON restores everything.
 */
export interface ModuleSettings {
  weddingBuilder: boolean;
  flavour: boolean;
  weight: boolean;
  shape: boolean;
  photoCake: boolean;
}

/**
 * The shop's own words for what it sells, overriding the business-type preset.
 *
 * Every field optional and every blank meaning "no opinion" — clearing a box
 * gives the preset back rather than an empty label. `resolveLabels` layers this
 * over `config/business-labels.ts` and the result ships as `settings.labels`.
 *
 * This existed on the server before it existed anywhere else: it was in no
 * client type, no default, no merge and no backup section, so nothing read it
 * and a shop had no way to say "Bouquet" instead of "Cake".
 */
export interface LabelOverrides {
  collectionsTitle?: string;
  collectionsSubtitle?: string;
  productWord?: string;
  productWordPlural?: string;
  /**
   * The four headings in the product description block.
   *
   * A shop writes what goes under them — its own facts, its delivery policy,
   * its care notes — so it should be able to write the headings too. A
   * florist has no "Care Instructions", it has "Looking after your flowers".
   *
   * Blank means the default, like every other override here: clearing a box
   * gives the preset back rather than an unnamed heading.
   */
  descriptionHeading?: string;
  detailsHeading?: string;
  deliveryHeading?: string;
  careHeading?: string;
}

export interface AppSettings {
  general: GeneralSettings;
  contact: ContactSettings;
  social: SocialLinkSettings[];
  security: SecuritySettings;
  smtp: SmtpSettings;
  analytics: AnalyticsSettings;
  maintenance: MaintenanceSettings;
  commerce: CommerceSettings;
  modules: ModuleSettings;
  labelOverrides: LabelOverrides;
  activity: ActivityLog[];
  updatedAt: string;
}
