/**
 * Bakery CMS — Design Principles
 * Source of truth for visual rules across admin, auth, and storefront.
 */

export const designPrinciples = {
  summary:
    "Clean, calm, and professional. Solid brand colors, soft borders, and clear hierarchy — never decorative noise.",
  /** Product theme split — do not blur these. */
  surfaces: {
    admin:
      "Admin CMS supports light and dark via ThemeToggle. Use semantic tokens (background, card, muted, foreground, border).",
    website:
      "Public website (/store, /account, /landing) is light-only forever. No dark mode. Brand primary / accent / cream come from Appearance settings.",
  },
  pillars: [
    {
      title: "Two surfaces, two rules",
      description:
        "Admin = light/dark theme system. Website = light design system only. Appearance changes website primary (and related brand colors); it does not add dark mode to the storefront.",
    },
    {
      title: "Solid color only",
      description:
        "Use flat brand tokens for backgrounds and fills. No linear, radial, or mesh gradients on surfaces, buttons, text, or decorative layers.",
    },
    {
      title: "Brand first",
      description:
        "Admin light primary is bakery brown (#6F4E37); admin dark primary shifts to gold for contrast. Website primary follows Appearance (default brown). Use the Bakery button variant when you need solid brown in both admin themes.",
    },
    {
      title: "Theme-aware admin shells",
      description:
        "Admin layout chrome must use semantic tokens so light and dark both work. Never hardcode cream/white on admin shells. Website may use cream and brand hexes — that is intentional for the light storefront.",
    },
    {
      title: "Soft structure",
      description:
        "Prefer 1px soft borders over heavy shadows. Keep radius modest. Let spacing and type create hierarchy.",
    },
    {
      title: "One job per block",
      description:
        "Each section has one purpose. Avoid tip cards, echo KPIs, sibling nav dumps, and decorative chrome that repeats the sidebar.",
    },
  ],
  do: [
    {
      label: "Surfaces",
      items: [
        "Admin: background / muted / card for page shells (theme-aware)",
        "Website: light cream / white shells; primary from Appearance",
        "Primary actions via bg-primary (admin: brown light / gold dark; website: Appearance primary)",
        "Soft borders via border-border for cards, inputs, and dividers",
        "Light shadow only when elevation is needed for interaction",
      ],
    },
    {
      label: "Layout & type",
      items: [
        "8px spacing grid for padding and gaps",
        "12–16px radius on cards and controls (website radius from Appearance)",
        "Clear heading → body hierarchy with Plus Jakarta / Inter",
        "Gold as ring/accent; Bakery variant when brown CTA is required in admin dark mode",
      ],
    },
    {
      label: "Product UI",
      items: [
        "Filter KPIs that change the list — not count echoes in the description",
        "Sticky mobile save bars for dirty forms",
        "Consistent empty, loading, and error states",
        "Accessible labels, focus rings, and tap targets (min ~36px)",
        "Admin only: light / dark via ThemeToggle — instant snap, no fade/flicker",
        "Website only: light design system + Appearance brand colors",
      ],
    },
  ],
  dont: [
    {
      label: "Visual effects",
      items: [
        "No gradient backgrounds, gradient text, or gradient borders",
        "No glassmorphism or backdrop-blur on content surfaces (modal scrim may use solid dim only)",
        "No neon, purple themes, or rainbow dashboards",
        "No heavy multi-layer drop shadows",
      ],
    },
    {
      label: "Shape & chrome",
      items: [
        "No pill shapes on every button and chip",
        "No floating badge stickers or promo overlays on heroes",
        "No over-designed decorative UI (orbs, flour dust, fake depth stacks)",
        "No inset hero cards when a full brand plane is intended",
        "No hardcoded bg-white / bg-cream on admin layout shells (breaks admin dark mode)",
        "No dark mode on the public website — ever",
      ],
    },
    {
      label: "Content clutter",
      items: [
        "No duplicate Related links that already exist in the sidebar",
        "No tip boxes that only restate the page title",
        "No fake / toast-only demo actions presented as real features",
        "No packing stats, schedules, and CTAs into the first viewport",
      ],
    },
  ],
  tokens: {
    primary: "#6F4E37",
    cream: "#FAF8F4",
    border: "#E8E5DF",
    accent: "#D4A373",
    radius: "12–16px",
    spacing: "8px grid",
  },
} as const;
