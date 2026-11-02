import type { ComponentType, SVGProps } from "react";
import {
  BarChart3Icon,
  BellIcon,
  BikeIcon,
  CalendarCheckIcon,
  CameraIcon,
  ChefHatIcon,
  IndianRupeeIcon,
  UserCogIcon,
  BoxesIcon,
  CakeIcon,
  CandyIcon,
  Flower2Icon,
  GiftIcon,
  LaptopIcon,
  ShirtIcon,
  ShoppingBasketIcon,
  UtensilsCrossedIcon,
  ClipboardCheckIcon,
  ClockIcon,
  CreditCardIcon,
  FileTextIcon,
  HomeIcon,
  ImageIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
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
  ShieldCheckIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  SparklesIcon,
  StarIcon,
  StoreIcon,
  TicketPercentIcon,
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
/* Section 4 — Customer Journey                                        */
/* ------------------------------------------------------------------ */

export const customerJourney: { icon: IconType; label: string }[] = [
  { icon: HomeIcon, label: "Home" },
  { icon: LayoutGridIcon, label: "Browse Cakes" },
  { icon: CakeIcon, label: "Product Details" },
  { icon: SparklesIcon, label: "Personalise" },
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
}[] = [
  { icon: LayoutDashboardIcon, title: "Dashboard", description: "Your whole business at a glance." },
  { icon: ShoppingBagIcon, title: "Orders", description: "Manage every order end to end." },
  { icon: UsersIcon, title: "Customers", description: "Profiles, history, and segments." },
  { icon: CakeIcon, title: "Products", description: "Cakes, catalog, and variants." },
  { icon: BoxesIcon, title: "Inventory", description: "Stock levels and low-stock alerts." },
  { icon: CreditCardIcon, title: "Payments", description: "Gateways, transactions, refunds." },
  { icon: TruckIcon, title: "Delivery", description: "Zones, slots, and shipping rules." },
  { icon: TicketPercentIcon, title: "Coupons", description: "Discounts and promo campaigns." },
  { icon: BarChart3Icon, title: "Reports", description: "Revenue and performance insights." },
  { icon: PanelsTopLeftIcon, title: "Homepage Builder", description: "Design your site visually." },
  { icon: FileTextIcon, title: "Pages", description: "About, policies, and pages of your own." },
  { icon: ImageIcon, title: "Media Library", description: "A central home for every asset." },
  { icon: SearchIcon, title: "SEO", description: "Metadata, sitemaps, and more." },
  { icon: ChefHatIcon, title: "Kitchen Board", description: "Today's orders to make, with a chime for each new one." },
  { icon: BikeIcon, title: "Rider Deliveries", description: "Each rider sees only their own drop-offs." },
  { icon: UserCogIcon, title: "Team & Roles", description: "Kitchen, delivery and manager logins." },
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
  { icon: MapPinIcon, title: "Delivery Zones", description: "By PIN code, city, or an area drawn on the map." },
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
  { icon: LayoutGridIcon, title: "Drag & Drop", description: "Reorder sections by simply moving them." },
  { icon: MonitorSmartphoneIcon, title: "Enable / Disable", description: "Toggle any section on or off instantly." },
  { icon: ImageIcon, title: "Backgrounds", description: "Set images, colors, and styles per section." },
  { icon: SparklesIcon, title: "Buttons", description: "Configure calls-to-action without code." },
  { icon: SearchIcon, title: "Live Preview", description: "See every change before it goes live." },
  { icon: RocketIcon, title: "Publish", description: "Push updates to your site in one click." },
];

/* ------------------------------------------------------------------ */
/* Section 9 — Payment System                                          */
/* ------------------------------------------------------------------ */

export const paymentMethods: { icon: IconType; name: string; note: string }[] = [
  { icon: ZapIcon, name: "Razorpay", note: "Into your account" },
  { icon: TruckIcon, name: "Cash on Delivery", note: "On arrival" },
  { icon: SmartphoneIcon, name: "UPI", note: "1-tap" },
  { icon: CreditCardIcon, name: "Cards", note: "Credit & debit" },
  { icon: ServerIcon, name: "Net Banking", note: "Major Indian banks" },
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
  { icon: PercentIcon, title: "No commission", description: "Your own website — no marketplace cut on every order." },
  { icon: UsersIcon, title: "Your customers stay yours", description: "Names, numbers and order history live in your admin." },
  { icon: IndianRupeeIcon, title: "Made for Indian shops", description: "UPI, cash on delivery, GST invoices, PIN code delivery." },
  { icon: ChefHatIcon, title: "Kitchen and rider screens", description: "Staff see only their own work, and hear each new order." },
  { icon: CameraIcon, title: "Photo cakes and custom orders", description: "Customers upload a photo and add a message to the cake." },
  { icon: MessageCircleIcon, title: "Customers kept informed", description: "Email and WhatsApp updates as an order moves." },
  { icon: ZapIcon, title: "Fast on phones", description: "Light pages, and every photo shrunk automatically." },
  { icon: SearchIcon, title: "Found on Google", description: "Page titles, descriptions, a sitemap and clean links." },
  { icon: ShieldCheckIcon, title: "Safe by default", description: "Staff roles, an activity log and device sign-out." },
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
/* Section 13 — How it works                                           */
/* ------------------------------------------------------------------ */

export const howItWorks: { icon: IconType; title: string; description: string }[] = [
  {
    icon: CalendarCheckIcon,
    title: "Book a demo",
    description: "We walk you through the storefront and the admin, and listen to how your shop works.",
  },
  {
    icon: SparklesIcon,
    title: "We set your shop up",
    description: "Your name, logo, products, delivery areas and payments — configured for you.",
  },
  {
    icon: RocketIcon,
    title: "You take orders",
    description: "Orders reach your kitchen with an alert, and payments go to your own account.",
  },
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
  { icon: ChefHatIcon, name: "Cloud Kitchen" },
];

export const faqs: { question: string; answer: string }[] = [
  /*
   * These three came from the short-lived /platform/pricing page. The other
   * three it carried — business type, mobile, and payment methods — already
   * had answers below, so only what was actually new moved here.
   */
  {
    question: "What is Bakery CMS?",
    answer:
      "Bakery CMS is an all-in-one platform to run your bakery online — website, orders, inventory, payments, delivery, and marketing, all from a single modern dashboard.",
  },
  {
    question: "Do you take a commission on my orders?",
    answer:
      "No. Online payments go straight into your own Razorpay account — Razorpay charges its standard payment fee, and nothing else is taken from an order. Cash on delivery costs nothing at all.",
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
    question: "Can my staff have their own logins?",
    answer:
      "Yes. Invite each person by email and give them a role — kitchen staff see only the orders to make, delivery staff only their own drop-offs, and a manager runs the orders. You can also build roles of your own, area by area.",
  },
  {
    question: "Which payment methods are supported?",
    answer:
      "Razorpay — which covers UPI, cards, net banking and wallets — and cash on delivery. Every order gets an invoice, and refunds, full or partial, are issued from the order.",
  },
  {
    question: "Can I manage delivery and shipping?",
    answer:
      "Yes. Draw delivery zones by PIN code, by city, or as an area on the map, each with its own charge, and offer the days and time slots you can actually deliver in. An address outside your zones is refused at checkout instead of becoming an order you cannot fulfil.",
  },
  {
    question: "Is it suitable for wedding and custom cakes?",
    answer:
      "Yes. Wedding cakes are a category like any other, and a product can take sizes, a message for the cake and the customer's own photo — ideal for bespoke, celebration, and made-to-order cakes.",
  },
  {
    question: "Can I customize my website design?",
    answer:
      "Yes. The built-in Homepage builder lets you arrange sections, change content and backgrounds, and publish changes instantly with a live preview.",
  },
  {
    question: "Will my store work well on mobile?",
    answer:
      "Every page — storefront and admin — is fully responsive and optimized for desktop, tablet, and mobile straight out of the box.",
  },
  {
    question: "What do I need before I can take a payment?",
    answer:
      "A Razorpay account for card, UPI and netbanking, and a Cloudinary account so you can upload your own photos. Both have free tiers. Cash on delivery works without either.",
  },
  {
    question: "What happens to an order if a payment fails halfway?",
    answer:
      "The payment webhook catches it. A payment taken with no order attached is flagged in the admin as an unclaimed payment so it can be refunded or matched, rather than quietly lost.",
  },
  {
    question: "Is my data mine?",
    answer:
      "Yes. Orders, customers and products live in your own MongoDB database, so any MongoDB backup tool can copy them, and nothing is locked to us. Settings also has a backup and restore screen for the shop's setup — layout, templates, delivery zones and coupons.",
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
      { label: "How it works", href: `${routes.platform.home}#how-it-works` },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Contact", href: vendorContact ?? undefined },
      { label: "Book a demo", href: vendorContact ?? undefined },
      { label: "Live store", href: routes.store.home },
    ],
  },
];
