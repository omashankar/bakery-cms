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
          "The demo phone number is a live phone link. Anyone who taps it before you change it is calling a number that is not yours.",
      },
      {
        title: "Switch payments on",
        body: "Turn on cash on delivery and Razorpay — which takes UPI, cards, net banking and wallets — and paste your Razorpay keys. Online payments land in your own Razorpay account.",
        where: { label: "Payments → Gateways", href: routes.admin.commerce.gateways },
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
        title: "Assign the delivery",
        body: "Pick one of your delivery staff on the order — they get an email, and the order appears on their own Deliveries screen — or type the name and number of someone outside the team. The customer's tracking page shows who is bringing it.",
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
        body: "Every order has an invoice the customer can open, print, or have emailed to them, and you can print it from the order. The invoice design — logo, address, terms, GST — is set once and applies to all of them.",
        where: { label: "Payments → Invoices", href: routes.admin.commerce.invoices },
      },
    ],
  },
  {
    id: "team",
    title: "Your team",
    summary:
      "Each person signs in with their own login and sees only their part of the shop — the kitchen what to make, a rider where to go.",
    steps: [
      {
        title: "Invite your staff",
        body: "Send an invite by email and pick a role: Manager, Kitchen Staff, Delivery Staff or Content Editor. They set their own password from the invite.",
        where: { label: "Settings → Team & permissions", href: routes.admin.settings.permissions },
        caution: "Invites go out by email, so set your mail server up first — Settings → SMTP.",
      },
      {
        title: "The kitchen board",
        body: "Kitchen staff open Kitchen and see what to make, soonest delivery first. A new order plays a chime and shows a count in the browser tab, and the board refreshes on its own every 30 seconds.",
        where: { label: "Kitchen", href: routes.admin.kitchen },
        caution:
          "A browser only plays sound after the page has been tapped once. Open the board and tap it at the start of the shift.",
      },
      {
        title: "Deliveries for riders",
        body: "A rider opens Deliveries on their phone and sees only the orders assigned to them — the address, the time window and what to hand over — and moves each one on as they go.",
        where: { label: "Deliveries", href: routes.admin.deliveries },
      },
      {
        title: "A role of your own",
        body: "When the four roles do not fit, build one: area by area, choose no access, view only, or full access.",
        where: { label: "Settings → Team & permissions", href: routes.admin.settings.permissions },
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
        body: "Name, description, photographs, price, category and occasion. Add the sizes this product comes in, each with its own surcharge, and the flavour words customers can filter by; the storefront prices the default size.",
        where: { label: "Products → Add", href: routes.admin.cakes.add },
        caution:
          "A cake stays hidden from customers until its status is Published. Draft and archived items are not shown, and not sold.",
      },
      {
        title: "Organise the menu",
        body: "Categories and occasions live in one place. Renaming a category here renames it everywhere — the storefront menu, the filters and the product pages. Sizes and flavours are typed on the product itself, so one product's list is never forced onto another.",
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
        title: "Header, footer and colours",
        body: "Your navigation menu and its call-to-action button are under Header, the footer columns under Footer, and the shop's colour palette under Appearance. Changes show on the storefront immediately.",
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
        body: "Create a coupon code with a percentage or flat discount, a minimum order value and an expiry date, for the whole shop or only some categories. Checkout validates it against the live cart, so a cart that stops qualifying loses the discount and says so.",
        where: { label: "Coupons", href: routes.admin.commerce.coupons },
        caution:
          "Set an expiry. A coupon without one keeps discounting for as long as the shop runs.",
      },
      {
        title: "Decide where you deliver",
        body: "Draw delivery zones by PIN code, by city, or as an area on the map, each with its own delivery charge. Free delivery above an order value is set once, for the whole shop. Checkout refuses an address outside your zones rather than accepting an order you cannot fulfil.",
        where: { label: "Delivery Zones", href: routes.admin.commerce.deliveryZones },
      },
      {
        title: "See what is working",
        body: "Revenue over time, best-selling cakes, your best customers, which payment methods people use, and which cities order most. Computed over every order, not a sample.",
        where: { label: "Reports", href: routes.admin.reports },
      },
      {
        title: "Answer enquiries",
        body: "Contact-form messages and newsletter signups land in one place, each with its own status so nothing is answered twice or not at all.",
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
        title: "Make sure mail arrives",
        body: "Send yourself a test, then run the delivery check: it reads your domain's mail records and, for Brevo, what happened to each recent message — so a mail that was accepted but never reached an inbox does not go unnoticed.",
        where: { label: "Settings → SMTP", href: routes.admin.settings.smtp },
      },
      {
        title: "See what went wrong",
        body: "Errors on the live site — on a page, in the admin or in a customer's browser — are kept for 30 days, grouped so the same fault is one line with a count.",
        where: { label: "Settings → Errors", href: routes.admin.settings.errors },
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
