import { routes } from "@/constants/routes";

/**
 * The shop owner's guide.
 *
 * Written against the screens that actually exist — every path below is a real
 * route in `constants/navigation.ts`, and every step describes a control that is
 * on that screen. It is a guide to running the shop, not to the code: someone
 * deploying this themselves wants `.env.example` and `npm run check` instead.
 *
 * Kept as data rather than markup so the page can build its own contents list
 * and anchor links from it without either drifting from the other.
 */

export interface DocStep {
  title: string;
  body: string;
  /** Where in the admin this is done. Rendered as a link when `href` is set. */
  where?: { label: string; href?: string };
  /** Something that is easy to get wrong, and what it costs. */
  caution?: string;
}

export interface DocChapter {
  id: string;
  title: string;
  summary: string;
  steps: DocStep[];
}

export const docChapters: DocChapter[] = [
  {
    id: "first-day",
    title: "Your first day",
    summary:
      "Four things turn a fresh install into a shop that can take an order. Do them in this order — each one unblocks the next.",
    steps: [
      {
        title: "Name the shop",
        body: "Set the shop name, tagline, logo, currency and timezone. The name reaches the browser tab, the invoices and every email, so this is the first thing to change — otherwise your customers see the demo name everywhere.",
        where: { label: "Settings → General", href: routes.admin.settings.general },
      },
      {
        title: "Put your own photos in",
        body: "Upload your cake photographs to the media library, then attach them to each product. A shipped install carries stock imagery; those are placeholders, not your cakes.",
        where: { label: "Media Library", href: routes.admin.media },
        caution:
          "Photo uploads need a Cloudinary account configured before they will work. Without it the library falls back to storing raw links.",
      },
      {
        title: "Fix the contact details",
        body: "Address, phone, email and opening hours. These appear in the footer of every storefront page, on the contact page, and on the invoice.",
        where: { label: "Settings → Contact", href: routes.admin.settings.contact },
        caution:
          "The demo phone number is a live `tel:` link. Anyone who taps it before you change it is calling a number that does not exist.",
      },
      {
        title: "Switch payments on",
        body: "Choose which methods you accept — cash on delivery, UPI, card, or Razorpay online payment — and connect the gateway.",
        where: { label: "Settings → Commerce", href: routes.admin.settings.commerce },
        caution:
          "A test key takes no real money. Swap to live keys only when you are ready to open, and register the payment webhook at the same time.",
      },
    ],
  },
  {
    id: "orders",
    title: "Taking orders",
    summary:
      "The part you will use every day. An order arrives, moves through the kitchen, and goes out for delivery.",
    steps: [
      {
        title: "See what came in",
        body: "Every order, newest first, with its status, payment state and total. Filter by status, date or amount, or search by order number, name, phone or email.",
        where: { label: "Orders", href: routes.admin.orders.list },
      },
      {
        title: "Move it along",
        body: "Open an order and set its status — confirmed, preparing, ready, out for delivery, delivered. The customer's tracking page follows along, so the status you set is what they see.",
        where: { label: "Orders → open one", href: routes.admin.orders.list },
      },
      {
        title: "Name the delivery person",
        body: "Once you know who is taking it, add their name and number to the order. That is what the customer's tracking page shows.",
        caution:
          "Until you set one, the tracking page says nobody has been assigned — which is true, and better than inventing a name.",
      },
      {
        title: "Cancel or refund",
        body: "Cancelling releases the coupon back to the customer and restores the stock. A refund can be full or partial, and is recorded against the order with a reason.",
        caution:
          "A refund through the admin tells Razorpay to refund as well. It settles at the bank's pace, not instantly — the order shows the refund as pending until it does.",
      },
      {
        title: "Send the invoice",
        body: "Every order has an invoice the customer can open, and you can email it to them from the order. The invoice design — logo, address, terms, GST — is set once and applies to all of them.",
        where: { label: "Payments → Invoices", href: routes.admin.commerce.invoices },
      },
    ],
  },
  {
    id: "catalogue",
    title: "Your cakes",
    summary:
      "What you sell, how it is priced, and whether it is in stock.",
    steps: [
      {
        title: "Add a cake",
        body: "Name, description, photographs, price, category and occasion. Add weight tiers (half kilo, one kilo) and flavour options; each can carry its own surcharge, and the storefront prices the default combination.",
        where: { label: "Cakes → Add", href: routes.admin.cakes.add },
        caution:
          "A cake stays hidden from customers until its status is Published. Draft and archived items are not shown, and not sold.",
      },
      {
        title: "Organise the menu",
        body: "Categories, flavours, occasions and weight options all live in one place. Renaming a category here renames it everywhere — the storefront menu, the filters and the product pages.",
        where: { label: "Catalog", href: routes.admin.catalog },
      },
      {
        title: "Keep stock honest",
        body: "Set a quantity per cake, or mark it unlimited. Every order reduces it, cancellations put it back, and you can adjust by hand with a reason that is kept in the history.",
        where: { label: "Inventory", href: routes.admin.commerce.inventory },
      },
      {
        title: "Moderate reviews",
        body: "Customer reviews arrive pending and are not shown until you approve them. Approving one updates the cake's star rating; rejecting keeps it out of sight.",
        where: { label: "Reviews", href: routes.admin.commerce.reviews },
        caution:
          "A shipped install comes with demo reviews written by nobody. Delete them from this screen — deleting here recalculates each cake's rating, which editing the database directly would not.",
      },
    ],
  },
  {
    id: "website",
    title: "Your website",
    summary:
      "The storefront is edited from the admin. No code, and no waiting for a developer.",
    steps: [
      {
        title: "Rearrange the homepage",
        body: "Add, remove, reorder and edit the sections your homepage is built from — hero, categories, featured cakes, offers, testimonials. Preview before publishing; a draft is only visible to you.",
        where: { label: "Homepage Builder", href: routes.admin.builders.homepage },
      },
      {
        title: "Wedding pages",
        body: "A separate builder for the wedding collection, with its own sections and its own enquiry form. Switch the whole module off if you do not do weddings.",
        where: { label: "Wedding Builder", href: routes.admin.builders.wedding },
      },
      {
        title: "Header, footer and colours",
        body: "Your navigation menu, the footer columns, the call-to-action button, and the shop's colour palette. Changes show on the storefront immediately.",
        where: { label: "Appearance", href: routes.admin.appearance },
      },
      {
        title: "Write your own pages",
        body: "About, Privacy, Terms, or anything else. Each gets its own web address and appears where you link it.",
        where: { label: "Pages", href: routes.admin.pages.list },
      },
    ],
  },
  {
    id: "growing",
    title: "Bringing customers back",
    summary: "Discounts, delivery areas, and knowing what is selling.",
    steps: [
      {
        title: "Run a discount",
        body: "Create a coupon code with a percentage or flat discount, a minimum order value, a usage limit and an expiry date. Checkout validates it against the live cart, so a cart that stops qualifying loses the discount and says so.",
        where: { label: "Coupons", href: routes.admin.commerce.coupons },
        caution:
          "Set an expiry. A coupon without one keeps discounting for as long as the shop runs.",
      },
      {
        title: "Decide where you deliver",
        body: "Add delivery zones by pincode, each with its own fee and free-delivery threshold. Checkout refuses an address outside them rather than accepting an order you cannot fulfil.",
        where: { label: "Delivery Zones", href: routes.admin.commerce.deliveryZones },
      },
      {
        title: "See what is working",
        body: "Revenue over time, best-selling cakes, repeat customers, which payment methods people use, and which cities order most. Computed over every order, not a sample.",
        where: { label: "Reports", href: routes.admin.reports },
      },
      {
        title: "Answer enquiries",
        body: "Contact-form messages, wedding enquiries and newsletter signups all land in one place, each with its own status so nothing is answered twice or not at all.",
        where: { label: "Inquiries", href: routes.admin.inquiries.overview },
      },
    ],
  },
  {
    id: "safe",
    title: "Keeping it safe",
    summary: "Who can get in, what they did, and what happens if something breaks.",
    steps: [
      {
        title: "Change your password",
        body: "From your own profile. Changing it signs every other device out, which is the point — if you are changing it because you are worried, that is what you want.",
        where: { label: "Profile → Password", href: routes.admin.changePassword },
      },
      {
        title: "Check your devices",
        body: "Every signed-in device is listed with when it was last seen. Sign one out, or sign out everywhere at once.",
        where: { label: "Settings → Security", href: routes.admin.settings.security },
      },
      {
        title: "See what was done",
        body: "Every meaningful action — a price change, a refund, a deletion, a sign-in — is recorded with who did it and when. The trail is append-only; nothing edits it.",
        where: { label: "Settings → Activity", href: routes.admin.settings.activity },
      },
      {
        title: "Close the shop temporarily",
        body: "Maintenance mode takes the storefront offline and shows a message you write. You and your admins can still browse it to check your work.",
        where: { label: "Settings → Maintenance", href: routes.admin.settings.maintenance },
        caution:
          "This genuinely stops customers ordering — it is not a banner. That is what makes it safe to use while you fix prices.",
      },
    ],
  },
];
