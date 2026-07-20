import type { ComponentType, SVGProps } from "react";
import {
  BarChart3Icon,
  BellIcon,
  BoxesIcon,
  CakeIcon,
  ClipboardCheckIcon,
  ClockIcon,
  CloudUploadIcon,
  CreditCardIcon,
  DatabaseIcon,
  FileTextIcon,
  HeartIcon,
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
  { label: "Features", href: "#features" },
  { label: "Solutions", href: "#commerce" },
  { label: "Modules", href: "#modules" },
  { label: "Pricing", href: "#pricing", soon: true },
  { label: "Documentation", href: "#docs", soon: true },
];

export const ctaLinks = {
  admin: routes.admin.dashboard,
  store: routes.store.home,
  getStarted: routes.auth.login,
  homepageBuilder: routes.admin.builders.homepage,
  weddingBuilder: routes.admin.builders.wedding,
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
  { icon: HeartIcon, title: "Wedding Builder", description: "Dedicated wedding landing pages.", status: "Templates" },
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
  { icon: TruckIcon, title: "Shipping Rules", description: "Flexible rates by weight, area, or order value." },
  { icon: CreditCardIcon, title: "Payment Gateways", description: "Razorpay, Stripe, PayPal and more, built in." },
  { icon: ClockIcon, title: "Order Timeline", description: "Track each order from placed to delivered." },
  { icon: RotateCcwIcon, title: "Refunds", description: "Issue full or partial refunds in a click." },
  { icon: FileTextIcon, title: "Invoices", description: "Automatic, branded invoices for every order." },
  { icon: TicketPercentIcon, title: "Coupons", description: "Run discounts, offers, and promo codes." },
  { icon: PercentIcon, title: "Taxes", description: "Configure GST and taxes with confidence." },
  { icon: BellIcon, title: "Notifications", description: "Keep customers updated at every step." },
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
/* Section 8 — Wedding Builder                                         */
/* ------------------------------------------------------------------ */

export const weddingBlocks: string[] = [
  "Hero",
  "Collections",
  "Offers",
  "Testimonials",
  "Inquiry",
  "FAQ",
  "CTA",
];

/* ------------------------------------------------------------------ */
/* Section 9 — Payment System                                          */
/* ------------------------------------------------------------------ */

export const paymentMethods: { icon: IconType; name: string; note: string }[] = [
  { icon: ZapIcon, name: "Razorpay", note: "Instant" },
  { icon: CreditCardIcon, name: "Stripe", note: "Global" },
  { icon: WalletIcon, name: "PayPal", note: "Trusted" },
  { icon: TruckIcon, name: "Cash on Delivery", note: "On arrival" },
  { icon: SmartphoneIcon, name: "UPI", note: "1-tap" },
  { icon: CreditCardIcon, name: "Cards", note: "Credit & debit" },
  { icon: ServerIcon, name: "Net Banking", note: "All banks" },
  { icon: WalletIcon, name: "Wallets", note: "Popular apps" },
  { icon: PercentIcon, name: "EMI", note: "Flexible" },
];

/* ------------------------------------------------------------------ */
/* Section 10 — Reports metrics                                        */
/* ------------------------------------------------------------------ */

export const reportMetrics: string[] = [
  "Revenue",
  "Orders",
  "Visitors",
  "Conversion",
  "Top Products",
  "Returning Customers",
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
  { icon: TrendingUpIcon, title: "Scalable", description: "From one shop to many locations." },
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
  "NestJS",
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
  { icon: ServerIcon, title: "Open API Access", description: "Connect your tools and automate workflows.", status: "Available" },
  { icon: DatabaseIcon, title: "Reliable Data Core", description: "Fast, structured storage for catalog and orders.", status: "Available" },
  { icon: CreditCardIcon, title: "Global Payments", description: "Accept payments from customers anywhere.", status: "Available" },
  { icon: CloudUploadIcon, title: "One-Click Deployment", description: "Go live on modern, reliable hosting.", status: "Available" },
  { icon: SmartphoneIcon, title: "Native Mobile Apps", description: "Manage your bakery on the go.", status: "Coming soon" },
];

/* ------------------------------------------------------------------ */
/* Section 14 — FAQ                                                    */
/* ------------------------------------------------------------------ */

export const faqs: { question: string; answer: string }[] = [
  {
    question: "What is Bakery CMS?",
    answer:
      "Bakery CMS is an all-in-one platform to run your bakery online — website, orders, inventory, payments, delivery, and marketing, all from a single modern dashboard.",
  },
  {
    question: "Do I need any coding or technical skills?",
    answer:
      "Not at all. Everything is managed visually, from your homepage layout to your product catalog. If you can use a web app, you can run your bakery on Bakery CMS.",
  },
  {
    question: "Can I customize my website design?",
    answer:
      "Yes. The built-in Homepage and Wedding builders let you arrange sections, change content and backgrounds, and publish changes instantly with a live preview.",
  },
  {
    question: "Which payment methods are supported?",
    answer:
      "Razorpay, Stripe, PayPal, UPI, cards, net banking, wallets, cash on delivery, and EMI are all supported out of the box, with automatic invoices and refunds.",
  },
  {
    question: "Can I manage delivery and shipping?",
    answer:
      "Absolutely. Configure delivery zones, time slots, and shipping rules that match exactly how your bakery operates, right down to per-area rates.",
  },
  {
    question: "Is it suitable for wedding and custom cakes?",
    answer:
      "Yes. A dedicated wedding builder and rich product customization make Bakery CMS ideal for bespoke, celebration, and made-to-order cakes.",
  },
  {
    question: "Will my store work well on mobile?",
    answer:
      "Every page — storefront and admin — is fully responsive and optimized for desktop, tablet, and mobile straight out of the box.",
  },
  {
    question: "How do I get started?",
    answer:
      "Explore the live admin demo and storefront to see everything in action, then launch your own bakery in minutes. No setup headaches, no credit card required to look around.",
  },
];

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

export const footerColumns: {
  heading: string;
  links: { label: string; href: string; soon?: boolean }[];
}[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Solutions", href: "#commerce" },
      { label: "Modules", href: "#modules" },
      { label: "Pricing", href: "#pricing", soon: true },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: "#docs", soon: true },
      { label: "Support", href: routes.store.contact },
      { label: "FAQ", href: "#faq" },
      { label: "Roadmap", href: "#roadmap" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: routes.store.about },
      { label: "Contact", href: routes.store.contact },
      { label: "Privacy", href: routes.store.privacy },
      { label: "Terms", href: routes.store.terms },
    ],
  },
];
