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

/**
 * One card in the row under the product photo.
 *
 * The reference storefront puts three there — “100% Purchase Protection /
 * Assured Quality Secure Payments”, “Serving Excellence / 20M Happy
 * Customers + 100% Satisfaction!”, “Timely Delivery / Different Time Slots
 * Available”. Every one is a claim, and two of the three are numbers this
 * software has no way to know. So the shop writes them, or the row is one
 * card long, or it is not there at all.
 *
 * SHOP-WIDE, unlike a description block: these say what the shop is like,
 * not what this product is. `icon` is a name from a fixed list because a
 * component cannot be stored or crossed over an API.
 */
export interface ProductTrustCard {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
}

/**
 * A speed of delivery the shop offers, and what it charges for it.
 *
 * Deliberately NOT a fixed Standard / Fixed Time / Midnight list. Those are
 * three things one shop happens to sell; a florist delivering inside an hour
 * and a furniture shop delivering inside a fortnight need their own words and
 * their own prices, and this CMS is sold to both.
 *
 * A shop with none of these configured is where every shop starts, and that is
 * the behaviour this software had before tiers existed: one delivery charge,
 * one flat list of windows, no choice to make.
 */
export interface DeliveryTier {
  id: string;
  /** The shop's own word for it — "Standard", "Before noon", whatever it sells. */
  label: string;
  /** Shown under the label. Blank prints nothing. */
  description: string;
  /** Added to the delivery charge. 0 is a real answer, and prints as free. */
  fee: number;
  /**
   * The windows this speed can be booked in.
   *
   * Empty means the tier takes no window at all — a next-day or a midnight
   * delivery has nothing to choose. The shop-wide `deliveryTimeSlots` list is
   * what a shop with no tiers uses, and it stays exactly as it was.
   */
  windows: string[];
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
  /** Empty on every shop that has not set any up. See `DeliveryTier`. */
  deliveryTiers: DeliveryTier[];
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
  /**
   * The cards under the product photo. Empty until the shop writes them.
   *
   * A hard-coded pair stood in the page instead: “Timely Delivery” and “Free
   * message card / Written as you ask”. The first is kept, because it reads
   * the shop's own lead time and so cannot go stale; the second was two
   * English sentences a shop selling anything else could not change.
   */
  productTrustCards: ProductTrustCard[];
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
   * The title over the whole product description block.
   *
   * Three more headings sat beside this one — details, delivery, care — from
   * when the block had three fixed parts. The parts are the shop's own now,
   * any number of them, each with a heading typed on the PRODUCT: a candle
   * wants "Care Directives" where a cake wants "Care Instructions", and no
   * shop-wide word is right for both. This one stays shop-wide because it
   * names the section rather than anything inside it.
   *
   * Blank means the default, like every other override here.
   */
  descriptionHeading?: string;
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
