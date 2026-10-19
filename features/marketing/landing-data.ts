import type { ComponentType, SVGProps } from "react";
import {
  BarChart3Icon,
  BellIcon,
  BoxesIcon,
  CakeIcon,
  CandyIcon,
  Flower2Icon,
  GiftIcon,
  LaptopIcon,
  PillIcon,
  ShirtIcon,
  ShoppingBasketIcon,
  UtensilsCrossedIcon,
  ClipboardCheckIcon,
  ClockIcon,
  CreditCardIcon,
  DatabaseIcon,
  FileTextIcon,
  HomeIcon,
  ImageIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  LayoutTemplateIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  MonitorSmartphoneIcon,
  PanelsTopLeftIcon,
  PercentIcon,
  RocketIcon,
  RotateCcwIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  SparklesIcon,
  StarIcon,
  StoreIcon,
  TicketPercentIcon,
  TrendingUpIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  ZapIcon,
} from "lucide-react";
import { routes } from "@/constants/routes";

export type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export const navLinks: { label: string; href: string; soon?: boolean }[] = [
  { label: "Features", href: `${routes.platform.home}#features` },
  { label: "Solutions", href: `${routes.platform.home}#commerce` },
  { label: "Modules", href: `${routes.platform.home}#modules` },
  { label: "Pricing", href: `${routes.platform.home}#pricing` },
  { label: "Documentation", href: routes.platform.docs },
];

/**
 * How someone reaches whoever SELLS this software. Null until there is one.
 *
 * Every call to action on this site used to point at `routes.store.contact` —
 * the SHOP’s contact form, under the bakery’s own navbar. A person weighing up
 * the software was handed a page for ordering cakes.
 *
 * Set this to a `mailto:` address or a real page and every button below turns
 * back on by itself. Left null they state the position in plain text rather
 * than moving anyone somewhere that is not ours.
 *
 * Note the demo links to `/store` are NOT this and should stay: showing the
 * storefront is showing the product running, which is the point.
 */
export const vendorContact: string | null =
  "mailto:sainiwebteams@gmail.com?subject=Bakery%20CMS%20demo";

export const ctaLinks = {
  /**
   * "Book a demo", not a link into the admin. The admin used to be the primary
   * call to action, and it opened a login screen with no way past it. Handing
   * out a demo login is not the answer either: the demo admin works on the live
   * database, enquiries and customers included. So the admin is shown on a call.
   */
  demo: vendorContact ?? `${routes.platform.home}#pricing`,
  store: routes.store.home,
  homepageBuilder: routes.admin.builders.homepage,

  reports: routes.admin.reports,
};

/* ------------------------------------------------------------------ */
/* Section 3 — Trusted Features                                        */
/* ------------------------------------------------------------------ */

export const trustedFeatures: {
  icon: IconType;
  title: string;
  description: string;
}[] = [
  {
    icon: LayoutTemplateIcon,
    title: "CMS Driven Website",
    description:
      "Publish and update every page of your bakery website visually — no code, no developers.",
  },
  {
    icon: ShoppingBagIcon,
    title: "Online Ordering",
    description:
      "Take cake orders online with customization, scheduling, and a secure, guided checkout.",
  },
  {
    icon: BoxesIcon,
    title: "Inventory",
    description:
      "Track stock and availability across your entire catalog in real time, automatically.",
  },
  {
    icon: TruckIcon,
    title: "Delivery",
    description:
      "Set delivery zones, time slots, and shipping rules that match how your bakery ships.",
  },
  {
    icon: CreditCardIcon,
    title: "Payments",
    description:
      "Accept every popular payment method with automatic invoices, taxes, and refunds.",
  },
  {
    icon: BarChart3Icon,
    title: "Analytics",
    description:
      "See revenue, orders, and customer trends together in one clear, elegant dashboard.",
  },
];

/* ------------------------------------------------------------------ */
/* Section 4 — Customer Journey                                        */
/* ------------------------------------------------------------------ */

export const customerJourney: { icon: IconType; label: string }[] = [
  { icon: HomeIcon, label: "Home" },
  { icon: LayoutGridIcon, label: "Browse Cakes" },
  { icon: CakeIcon, label: "Product Details" },
  { icon: SparklesIcon, label: "Customization" },
  { icon: ShoppingCartIcon, label: "Cart" },
  { icon: ClipboardCheckIcon, label: "Checkout" },
  { icon: CreditCardIcon, label: "Payment" },
  { icon: TruckIcon, label: "Order Tracking" },
  { icon: StarIcon, label: "Review" },
];

/* ------------------------------------------------------------------ */
/* Section 5 — Admin Dashboard Modules                                 */
/* ------------------------------------------------------------------ */

export const adminModules: {
  icon: IconType;
  title: string;
  description: string;
  status: string;
}[] = [
  { icon: LayoutDashboardIcon, title: "Dashboard", description: "Your whole business at a glance.", status: "Real-time" },
  { icon: ShoppingBagIcon, title: "Orders", description: "Manage every order end to end.", status: "Live" },
  { icon: UsersIcon, title: "Customers", description: "Profiles, history, and segments.", status: "CRM" },
  { icon: CakeIcon, title: "Products", description: "Cakes, catalog, and variants.", status: "Catalog" },
  { icon: BoxesIcon, title: "Inventory", description: "Stock levels and low-stock alerts.", status: "Real-time" },
  { icon: CreditCardIcon, title: "Payments", description: "Gateways, transactions, refunds.", status: "Secure" },
  { icon: TruckIcon, title: "Delivery", description: "Zones, slots, and shipping rules.", status: "Configurable" },
  { icon: TicketPercentIcon, title: "Coupons", description: "Discounts and promo campaigns.", status: "Marketing" },
  { icon: BarChart3Icon, title: "Reports", description: "Revenue and performance insights.", status: "Analytics" },
  { icon: PanelsTopLeftIcon, title: "Homepage Builder", description: "Design your site visually.", status: "Drag & drop" },
  { icon: FileTextIcon, title: "Pages", description: "About, policies, and pages of your own.", status: "No code" },
  { icon: ImageIcon, title: "Media Library", description: "A central home for every asset.", status: "Cloud" },
  { icon: SearchIcon, title: "SEO", description: "Metadata, sitemaps, and more.", status: "Optimized" },
  { icon: SettingsIcon, title: "Settings", description: "Configure the whole platform.", status: "Flexible" },
];

/* ------------------------------------------------------------------ */
/* Section 6 — Commerce Features                                       */
/* ------------------------------------------------------------------ */

export const commerceFeatures: {
  icon: IconType;
  title: string;
  description: string;
}[] = [
  { icon: BoxesIcon, title: "Inventory Management", description: "Keep stock accurate across every product and variant." },
  { icon: MapPinIcon, title: "Delivery Zones", description: "Define exactly where, and when, you deliver." },
  { icon: TruckIcon, title: "Shipping Rules", description: "Rates by area, and free delivery over an order value." },
  { icon: CreditCardIcon, title: "Payment Gateways", description: "Razorpay for UPI, cards, net banking and wallets." },
  { icon: ClockIcon, title: "Order Timeline", description: "Track each order from placed to delivered." },
  { icon: RotateCcwIcon, title: "Refunds", description: "Issue full or partial refunds in a click." },
  { icon: FileTextIcon, title: "Invoices", description: "A branded, printable invoice for every order." },
  { icon: TicketPercentIcon, title: "Coupons", description: "Run discounts, offers, and promo codes." },
  { icon: PercentIcon, title: "Taxes", description: "Configure GST and taxes with confidence." },
  { icon: BellIcon, title: "Notifications", description: "Email and WhatsApp updates as an order moves." },
  { icon: MailIcon, title: "Email Templates", description: "Beautiful, editable transactional emails." },
  { icon: MessageCircleIcon, title: "WhatsApp Templates", description: "Send order updates straight to WhatsApp." },
];

/* ------------------------------------------------------------------ */
/* Section 7 — Website Builder                                         */
/* ------------------------------------------------------------------ */

export const builderCapabilities: { icon: IconType; title: string; description: string }[] = [
  { icon: LayoutGridIcon, title: "Drag & Drop", description: "Rearrange sections by simply moving them." },
  { icon: MonitorSmartphoneIcon, title: "Enable / Disable", description: "Toggle any section on or off instantly." },
  { icon: TrendingUpIcon, title: "Sorting", description: "Order your content exactly how you want it." },
  { icon: ImageIcon, title: "Backgrounds", description: "Set images, colors, and styles per section." },
  { icon: SparklesIcon, title: "Buttons", description: "Configure calls-to-action without code." },
  { icon: SearchIcon, title: "Live Preview", description: "See every change before it goes live." },
  { icon: RocketIcon, title: "Publish", description: "Push updates to your site in one click." },
];

/* ------------------------------------------------------------------ */
/* Section 9 — Payment System                                          */
/* ------------------------------------------------------------------ */

export const paymentMethods: { icon: IconType; name: string; note: string }[] = [
  { icon: ZapIcon, name: "Razorpay", note: "Instant" },
  { icon: TruckIcon, name: "Cash on Delivery", note: "On arrival" },
  { icon: SmartphoneIcon, name: "UPI", note: "1-tap" },
  { icon: CreditCardIcon, name: "Cards", note: "Credit & debit" },
  { icon: ServerIcon, name: "Net Banking", note: "All banks" },
  { icon: WalletIcon, name: "Wallets", note: "Popular apps" },
];

/* ------------------------------------------------------------------ */
/* Section 10 — Reports metrics                                        */
/* ------------------------------------------------------------------ */

export const reportMetrics: string[] = [
  "Revenue",
  "Orders",
  "Top Products",
  "Top Customers",
  "Payment Mix",
  "Top Cities",
];

/* ------------------------------------------------------------------ */
/* Section 11 — Why Choose                                             */
/* ------------------------------------------------------------------ */

export const whyChoose: { icon: IconType; title: string; description: string }[] = [
  { icon: MonitorSmartphoneIcon, title: "Responsive", description: "Flawless on desktop, tablet, and mobile." },
  { icon: SearchIcon, title: "SEO Ready", description: "Built to rank with clean metadata." },
  { icon: RocketIcon, title: "Future Ready", description: "Architected to grow with your business." },
  { icon: ZapIcon, title: "Fast", description: "Optimized for speed on every page." },
  { icon: SparklesIcon, title: "Modern", description: "A refined, contemporary interface." },
  { icon: LayoutDashboardIcon, title: "Clean UI", description: "Intuitive design your team will love." },
  { icon: PanelsTopLeftIcon, title: "CMS Driven", description: "Every section editable, no code." },
  { icon: TrendingUpIcon, title: "Scalable", description: "From a dozen products to thousands." },
  { icon: ShieldCheckIcon, title: "Secure", description: "Protected data and safe payments." },
];

/* ------------------------------------------------------------------ */
/* Section 12 — Technology                                             */
/* ------------------------------------------------------------------ */

export const techStack: string[] = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind",
  "Shadcn UI",
  "MongoDB",
  "Node.js",
  "Cloudinary",
  "JWT",
];

/* ------------------------------------------------------------------ */
/* Section 13 — Roadmap                                                */
/* ------------------------------------------------------------------ */

export const roadmap: {
  icon: IconType;
  title: string;
  description: string;
  status: "Available" | "Coming soon";
}[] = [
  { icon: MonitorSmartphoneIcon, title: "Storefront Experience", description: "A polished, conversion-ready customer website.", status: "Available" },
  { icon: LayoutDashboardIcon, title: "Business Dashboard", description: "A complete admin to run daily operations.", status: "Available" },
  { icon: MessageCircleIcon, title: "WhatsApp Order Updates", description: "Order messages sent from your own business number.", status: "Available" },
  { icon: DatabaseIcon, title: "Reliable Data Core", description: "Fast, structured storage for catalog and orders.", status: "Available" },
  { icon: CreditCardIcon, title: "Online Payments", description: "UPI, cards, net banking and wallets through Razorpay.", status: "Available" },
  { icon: MapPinIcon, title: "Delivery Zones & Slots", description: "Deliver by PIN code, on the day and hour customers pick.", status: "Available" },
];

/* ------------------------------------------------------------------ */
/* Section 14 — FAQ                                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Business types — one CMS, any business                              */
/* ------------------------------------------------------------------ */

export const businessTypes: { icon: IconType; name: string }[] = [
  { icon: CakeIcon, name: "Bakery" },
  { icon: CandyIcon, name: "Sweet Shop" },
  { icon: Flower2Icon, name: "Flower Shop" },
  { icon: UtensilsCrossedIcon, name: "Restaurant" },
  { icon: GiftIcon, name: "Gift Shop" },
  { icon: ShoppingBasketIcon, name: "Grocery" },
  { icon: ShirtIcon, name: "Fashion" },
  { icon: LaptopIcon, name: "Electronics" },
  { icon: PillIcon, name: "Pharmacy" },
];

export const faqs: { question: string; answer: string }[] = [
  /*
   * These three came from the short-lived /platform/pricing page. The other
   * three it carried — business type, mobile, and payment methods — already
   * had answers below, so only what was actually new moved here.
   */
  {
    question: "What do I need before I can take a payment?",
    answer:
      "A Razorpay account for card, UPI and netbanking, and a Cloudinary account so you can upload your own photos. Both have free tiers. Cash on delivery works without either.",
  },
  {
    question: "Is my data mine?",
    answer:
      "Yes. Orders, customers and products live in your own MongoDB database, so any MongoDB backup tool can copy them, and nothing is locked to us. Settings also has a backup and restore screen for the shop's setup — layout, templates, delivery zones and coupons.",
  },
  {
    question: "What happens to an order if a payment fails halfway?",
    answer:
      "The payment webhook catches it. A payment taken with no order attached is flagged in the admin as an unclaimed payment so it can be refunded or matched, rather than quietly lost.",
  },
  {
    question: "What is Bakery CMS?",
    answer:
      "Bakery CMS is an all-in-one platform to run your bakery online — website, orders, inventory, payments, delivery, and marketing, all from a single modern dashboard.",
  },
  {
    question: "Can I use it for a business other than a bakery?",
    answer:
      "Yes, and there is no business type to switch. You choose what to call your products, define the options they come in — size, colour, flavour, storage — and add your own product details like Brand or Warranty. One shop can sell cakes, cold drinks, gift hampers and chargers side by side, all from the same catalogue.",
  },
  {
    question: "Do I need any coding or technical skills?",
    answer:
      "Not at all. Everything is managed visually, from your homepage layout to your product catalog. If you can use a web app, you can run your bakery on Bakery CMS.",
  },
  {
    question: "Can I customize my website design?",
    answer:
      "Yes. The built-in Homepage builder lets you arrange sections, change content and backgrounds, and publish changes instantly with a live preview.",
  },
  {
    question: "Which payment methods are supported?",
    answer:
      "Razorpay — which covers UPI, cards, net banking and wallets — and cash on delivery. Every order gets an invoice, and refunds, full or partial, are issued from the order.",
  },
  {
    question: "Can I manage delivery and shipping?",
    answer:
      "Absolutely. Configure delivery zones, time slots, and shipping rules that match exactly how your bakery operates, right down to per-area rates.",
  },
  {
    question: "Is it suitable for wedding and custom cakes?",
    answer:
      "Yes. Wedding cakes are a category like any other, and a product can take sizes, a message for the cake and the customer's own photo — ideal for bespoke, celebration, and made-to-order cakes.",
  },
  {
    question: "Will my store work well on mobile?",
    answer:
      "Every page — storefront and admin — is fully responsive and optimized for desktop, tablet, and mobile straight out of the box.",
  },
  {
    question: "How do I get started?",
    answer:
      "Look around the live storefront, then book a demo and we will walk you through the admin — no credit card required. Going live needs your own database, a Razorpay account and a Cloudinary account; the Documentation walks through the rest.",
  },
];

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

export const socialLinks: { icon: IconType; label: string; href: string }[] = [
  { icon: StoreIcon, label: "Visit our storefront", href: routes.store.home },
  // Mail, chat and phone used to sit here, and all three opened the SHOP’s
  // contact form — three icons, one destination, and the wrong one. An icon
  // that goes nowhere is decoration, so unlike the text links above they are
  // removed rather than left inert. The storefront link stays: it is this
  // software running, which is the thing a prospect actually wants to see.
];

export const footerColumns: {
  heading: string;
  /**
   * `href` is optional on purpose. These five — Support, About, Contact,
   * Privacy and Terms — pointed at the SHOP’s pages, so someone weighing up
   * the software landed on a bakery’s About page, or a privacy policy about
   * cake orders. Same mistake as serving the product page at `/`, in the
   * other direction.
   *
   * The vendor has no such pages yet, and a privacy policy is not a thing to
   * invent. So the labels stay — the footer keeps its shape and says what
   * will be there — and they simply do not move anyone until a real address
   * exists. Add the `href` back and it becomes a link again, nothing else.
   */
  links: { label: string; href?: string; soon?: boolean }[];
}[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: `${routes.platform.home}#features` },
      { label: "Solutions", href: `${routes.platform.home}#commerce` },
      { label: "Modules", href: `${routes.platform.home}#modules` },
      { label: "Pricing", href: `${routes.platform.home}#pricing` },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: routes.platform.docs },
      { label: "Support", href: vendorContact ?? undefined },
      { label: "FAQ", href: `${routes.platform.home}#faq` },
      { label: "Roadmap", href: `${routes.platform.home}#roadmap` },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About" },
      { label: "Contact", href: vendorContact ?? undefined },
      { label: "Privacy" },
      { label: "Terms" },
    ],
  },
];
