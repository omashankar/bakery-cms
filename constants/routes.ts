/**
 * Bakery CMS — Central route definitions
 * Single source of truth for all app URLs
 */

export const routes = {
  /** Redirects to `/store` — see next.config.ts. */
  home: "/",

  /** Design system */
  designSystem: "/design-system",

  /** Legacy address for the product page — 308s to `/platform`. */
  landing: "/landing",

  /**
   * The product’s own marketing site, for whoever is deciding whether to RUN
   * this software. Deliberately not at `/` — that belongs to the shop, and a
   * customer arriving from Instagram should meet cakes, not a dashboard advert.
   */
  platform: {
    home: "/platform",
    // Pricing is a SECTION of the landing page (`#pricing`), not a route:
    // three cards and a caption is not a page, and splitting it off made
    // someone leave the feature sections to find out what it costs.
    docs: "/platform/docs",
  },

  /** Public bakery website */
  store: {
    home: "/store",
    collections: "/store/collections",
    collection: (slug: string) => `/store/collections/${slug}`,
    /**
     * AN OCCASION HAS ITS OWN ADDRESS, and that is the whole difference.
     *
     * Occasions used to live at `/store/collections/<slug>` alongside
     * categories and collections, and the listing there ORs the two: a slug
     * matched a category's products and an occasion's tags together. So a shop
     * with a "Birthday Cakes" category and a "Birthday" occasion — which this
     * one has, along with Wedding and Anniversary — could not have a page for
     * either. One address, one merged grid, and the category's name on top of
     * it; the occasion had 19 products and no way to show its own.
     *
     * The old address still resolves, unchanged. This is a second door, not a
     * move: every link written before today still works.
     */
    occasion: (slug: string) => `/store/occasions/${slug}`,
    /**
     * A DEPARTMENT'S OWN PAGE.
     *
     * The kind of thing a shop sells — Cakes, Flowers, Gifts — holding the
     * categories it filed under it. It had no address at all: the header drew
     * it as a heading and the trail above a product as a plain word, both
     * carrying a comment that a crumb is a promise a page exists and this one
     * did not. It does now.
     *
     * A SIBLING of the occasion page, not a parent of the category one. A
     * category keeps `/store/collections/<slug>` — where every pill, menu row
     * and card links — because nesting it would move 29 products' addresses
     * the day a shop re-files one, which is the reasoning the flat product
     * address above already records.
     */
    department: (slug: string) => `/store/departments/${slug}`,
    /**
     * A PRODUCT'S OWN ADDRESS — and it stopped saying "cakes".
     *
     * This shop is going to sell flowers, plants, gifts, chocolates, fashion,
     * mobiles, electronics, beauty, home, toys and sports. A bouquet at
     * /store/cakes/red-roses is a CMS telling a customer what trade its shop
     * is in, and getting it wrong.
     *
     * FLAT, not /store/<department>/<category>/<slug>. Three of this shop's
     * 29 products are filed under TWO categories each — Black Forest Supreme
     * is under Chocolate Cakes AND Cream Cakes — so a nested address has to
     * pick one, and it changes the day the shop re-files the product. An
     * address that moves when somebody tidies the catalogue is an address
     * nobody can link to.
     *
     * The old one still resolves: see the 307 in next.config.ts. Temporary,
     * because a browser caches a permanent redirect more or less for ever and
     * this shape is one a deployment might reasonably revisit.
     *
     * The FOLDER moved too — app/(storefront)/store/p/[slug] — because a
     * route's path is its directory. `loading.tsx` moved with it; leaving it
     * behind is a page that silently loses its skeleton.
     */
    product: (slug: string) => `/store/p/${slug}`,
    /**
     * @deprecated The old name, kept so nothing breaks mid-rename. Points at
     * the new address — it was never the folder name that mattered to a
     * caller, only where the link goes.
     */
    cake: (slug: string) => `/store/p/${slug}`,


    contact: "/store/contact",
    faq: "/store/faq",
    privacy: "/store/privacy",
    terms: "/store/terms",
    thankYou: "/store/thank-you",
    cart: "/store/cart",
    checkout: "/store/checkout",
    orderSuccess: "/store/order/success",
    orderTrack: "/store/order/track",
    orderDetail: (orderNumber: string) => `/store/order/${encodeURIComponent(orderNumber)}`,
    orderInvoice: (orderNumber: string) => `/store/order/${encodeURIComponent(orderNumber)}/invoice`,
    wishlist: "/store/wishlist",
    page: (slug: string) => `/store/pages/${slug}`,
  },

  /** Customer account (UI only) — auth is handled by the login modal, not pages */
  account: {
    dashboard: "/account",
    orders: "/account/orders",
    addresses: "/account/addresses",
  },

  /** Admin authentication (UI only) */
  auth: {
    login: "/login",
    forgotPassword: "/forgot-password",
    otp: "/otp",
    resetPassword: "/reset-password",
    success: "/auth/success",
    error: "/auth/error",
    sessionExpired: "/auth/session-expired",
  },

  /** Admin CMS */
  admin: {
    root: "/admin",
    dashboard: "/admin/dashboard",
    profile: "/admin/profile",
    changePassword: "/admin/profile/password",

    cakes: {
      list: "/admin/cakes",
      add: "/admin/cakes/add",
      edit: (id: string) => `/admin/cakes/${id}/edit`,
      preview: (id: string) => `/admin/cakes/${id}/preview`,
    },

    catalog: "/admin/catalog",
    banners: "/admin/banners",
    testimonials: "/admin/testimonials",
    faq: "/admin/faq",

    builders: {
      homepage: "/admin/builders/homepage",

    },

    pages: {
      list: "/admin/pages",
      add: "/admin/pages/add",
      edit: (id: string) => `/admin/pages/${id}/edit`,
    },
    header: "/admin/header",
    footer: "/admin/footer",
    seo: "/admin/seo",

    media: "/admin/media",

    inquiries: {
      overview: "/admin/inquiries",
      wedding: "/admin/inquiries/wedding",
      contact: "/admin/inquiries/contact",
      newsletter: "/admin/inquiries/newsletter",
    },

    appearance: "/admin/appearance",

    settings: {
      overview: "/admin/settings",
      general: "/admin/settings/general",
      modules: "/admin/settings/modules",
      contact: "/admin/settings/contact",
      social: "/admin/settings/social",
      security: "/admin/settings/security",
      smtp: "/admin/settings/smtp",
      analytics: "/admin/settings/analytics",
      maintenance: "/admin/settings/maintenance",
      backup: "/admin/settings/backup",
      activity: "/admin/settings/activity",
      commerce: "/admin/settings/commerce",
      permissions: "/admin/settings/permissions",
      customCode: "/admin/settings/custom-code",
      navigation: "/admin/settings/navigation",
      seoFiles: "/admin/settings/seo-files",
      sms: "/admin/settings/sms",
    },

    /** Commerce operations — orders, inventory, delivery, tax, notifications */
    commerce: {
      coupons: "/admin/commerce/coupons",
      inventory: "/admin/commerce/inventory",
      payments: "/admin/commerce/payments",
      gateways: "/admin/commerce/payments/gateways",
      gateway: (id: string) => `/admin/commerce/payments/gateways/${id}`,
      transactions: "/admin/commerce/payments/transactions",
      paymentNotifications: "/admin/commerce/payments/notifications",
      deliveryZones: "/admin/commerce/delivery-zones",
      deliverySlots: "/admin/commerce/delivery-slots",
      taxes: "/admin/commerce/taxes",
      shippingRules: "/admin/commerce/shipping-rules",
      notifications: "/admin/commerce/notifications",
      reviews: "/admin/commerce/reviews",
      emails: "/admin/commerce/emails",
      whatsapp: "/admin/commerce/whatsapp",
      invoices: "/admin/commerce/invoices",
      refunds: "/admin/commerce/payments/refunds",
    },

    orders: {
      list: "/admin/orders",
      detail: (id: string) => `/admin/orders/${id}`,
    },

    customers: {
      list: "/admin/customers",
      detail: (id: string) => `/admin/customers/${id}`,
    },

    reports: "/admin/reports",
  },
} as const;

export type Routes = typeof routes;
