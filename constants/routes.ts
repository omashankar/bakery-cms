/**
 * Bakery CMS — Central route definitions
 * Single source of truth for all app URLs
 */

export const routes = {
  /** Dev / architecture hub */
  home: "/",

  /** Design system */
  designSystem: "/design-system",

  /** Marketing landing — redirects to storefront */
  landing: "/landing",

  /** Public bakery website */
  store: {
    home: "/store",
    collections: "/store/collections",
    collection: (slug: string) => `/store/collections/${slug}`,
    cake: (slug: string) => `/store/cakes/${slug}`,
    weddingCakes: "/store/wedding-cakes",
    about: "/store/about",
    gallery: "/store/gallery",
    contact: "/store/contact",
    faq: "/store/faq",
    search: "/store/search",
    privacy: "/store/privacy",
    terms: "/store/terms",
    thankYou: "/store/thank-you",
    cart: "/store/cart",
    checkout: "/store/checkout",
    checkoutPayment: "/store/checkout/payment",
    checkoutPaymentFailed: "/store/checkout/payment/failed",
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
      wedding: "/admin/builders/wedding",
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
      refunds: "/admin/commerce/refunds",
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
