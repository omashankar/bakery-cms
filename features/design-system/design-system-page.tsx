"use client";

import { motion } from "framer-motion";
import {
  Bell,
  Cake,
  Check,
  Home,
  Search,
  Star,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { routes } from "@/constants/routes";
import { ColorSwatch } from "@/components/design-system/color-swatch";
import {
  DemoLabel,
  DemoNote,
  DesignSection,
} from "@/components/design-system/design-section";
import { useTheme } from "@/components/providers/theme-provider";
import { BakeryCmsBrand } from "@/components/shared/bakery-cms-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { brandColors, bakeryColors, surfaces } from "@/constants/colors";
import { designPrinciples } from "@/constants/design-principles";
import { layoutSpacing } from "@/constants/spacing";
import { typographyPresets } from "@/constants/typography";
import { useMounted } from "@/hooks/use-mounted";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "theme", label: "Theme" },
  { id: "principles", label: "Principles" },
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing" },
  { id: "buttons", label: "Buttons" },
  { id: "forms", label: "Forms" },
  { id: "cards", label: "Cards" },
  { id: "feedback", label: "Feedback" },
  { id: "navigation", label: "Navigation" },
  { id: "surfaces", label: "Surfaces" },
] as const;

const spacingScale = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

const LIVE_SURFACE_TOKENS = [
  { name: "background", swatch: "bg-background", note: "Page shell" },
  { name: "card", swatch: "bg-card", note: "Panels & cards" },
  { name: "muted", swatch: "bg-muted", note: "Section alternate" },
  { name: "primary", swatch: "bg-primary", note: "Main actions" },
  { name: "secondary", swatch: "bg-secondary", note: "Secondary fill" },
  { name: "popover", swatch: "bg-popover", note: "Menus & dialogs" },
  { name: "destructive", swatch: "bg-destructive", note: "Errors / danger" },
  { name: "sidebar", swatch: "bg-sidebar", note: "Admin nav" },
] as const;

const TYPE_SAMPLES = [
  { label: "Display", className: typographyPresets.display, sample: "Crafted with Care", note: "Hero only" },
  { label: "Heading 1", className: typographyPresets.h1, sample: "Bakery catalog", note: "Page titles" },
  { label: "Heading 2", className: typographyPresets.h2, sample: "Seasonal cakes", note: "Section titles" },
  { label: "Heading 3", className: typographyPresets.h3, sample: "Chocolate truffle", note: "Card titles" },
  { label: "Heading 4", className: typographyPresets.h4, sample: "Order details", note: "Subheads" },
  { label: "Body", className: typographyPresets.body, sample: "Every cake tells a story. Keep line length comfortable and spacing generous.", note: "16px body" },
  { label: "Body large", className: typographyPresets.bodyLg, sample: "Use for intro copy under a page title.", note: "18px lead" },
  { label: "Caption", className: typographyPresets.caption, sample: "Updated 2 hours ago · SKU-1042", note: "Meta / hints" },
  { label: "Overline", className: typographyPresets.overline, sample: "Admin · Catalog", note: "Eyebrows" },
] as const;

const SPACING_USAGE = [
  { name: "Card padding", value: "24px", token: "spacing[6] / p-6" },
  { name: "Section gap", value: "64px", token: "space-y-16 on page" },
  { name: "Field gap", value: "16px", token: "spacing[4] / gap-4" },
  { name: "Inline gap", value: "12px", token: "spacing[3] / gap-3" },
  { name: "Button height", value: "32–36px", token: "h-8 default · h-9 lg" },
  { name: "Container", value: "max-w-7xl", token: layoutSpacing.container },
] as const;

function PrincipleList({
  tone,
  groups,
}: {
  tone: "do" | "dont";
  groups: readonly { label: string; items: readonly string[] }[];
}) {
  const mark = tone === "do" ? "✓" : "✗";
  const markClass =
    tone === "do"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {group.label}
          </p>
          <ul className="space-y-2">
            {group.items.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
              >
                <span className={cn("mt-0.5 shrink-0 font-semibold", markClass)}>
                  {mark}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SurfaceTokenGrid({
  tokens,
}: {
  tokens: readonly { name: string; swatch: string; note: string }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tokens.map((token) => (
          <div key={token.name} className="space-y-2">
            <div
              className={cn(
                "h-14 rounded-xl border border-border",
                token.swatch
              )}
              aria-hidden
            />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold capitalize text-foreground">
                {token.name}
              </p>
              <p className="text-xs text-muted-foreground">{token.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DesignSystemPage() {
  const mounted = useMounted();
  const { theme, resolvedTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<string>("theme");
  const modeLabel = !mounted
    ? "…"
    : (theme ?? resolvedTheme) === "dark"
      ? "Dark"
      : "Light";

  useEffect(() => {
    const ids = navItems.map((item) => item.id);

    const syncHash = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (id && ids.includes(id as (typeof ids)[number])) {
        setActiveSection(id);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id;
        if (top) setActiveSection(top);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.25, 0.5] }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <BakeryCmsBrand subtitle="Design System" size="md" />
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              Mode: {modeLabel}
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-12 xl:gap-16">
          <aside className="hidden lg:block lg:w-52 lg:shrink-0">
            <nav className="sticky top-24 space-y-1 rounded-2xl border border-border bg-card p-2">
              <p className="px-3 py-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                On this page
              </p>
              {navItems.map((item) => {
                const active = activeSection === item.id;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    aria-current={active ? "location" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm transition-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </aside>

          <motion.main
            className="min-w-0 flex-1 space-y-16"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeUp} className="space-y-4">
              <Badge variant="bakery">Source of truth</Badge>
              <h1 className={cn(typographyPresets.h1, "text-foreground")}>
                Bakery CMS Design System
              </h1>
              <p className={cn(typographyPresets.bodyLg, "max-w-2xl")}>
                {designPrinciples.summary}{" "}
                <span className="font-medium text-foreground">Admin</span> uses
                light/dark;{" "}
                <span className="font-medium text-foreground">website</span> stays
                light and follows Appearance brand colors —{" "}
                <span className="font-medium text-foreground">no gradients</span>.
              </p>
              <p className="text-sm text-muted-foreground sm:hidden">
                Current mode:{" "}
                <span className="font-medium text-foreground">{modeLabel}</span>
              </p>
            </motion.div>

            {/* Theme */}
            <motion.div variants={staggerItem}>
              <DesignSection
                id="theme"
                title="Light & Dark (Admin)"
                description="Admin CMS only. The public website stays light forever — its primary comes from Appearance settings."
              >
                <div className="space-y-6">
                  <DemoNote>
                    <p className="font-medium text-foreground">
                      Two surfaces
                    </p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-4">
                      <li>
                        <span className="font-medium text-foreground">Admin</span>{" "}
                        — light / dark via ThemeToggle
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Website</span>{" "}
                        — light design system only; brand colors from Appearance
                      </li>
                    </ul>
                  </DemoNote>

                  <div className="sticky top-[4.75rem] z-30 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Admin color mode
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Now showing{" "}
                        <span className="font-medium text-foreground">
                          {modeLabel}
                        </span>
                        . Click the icon to switch light ↔ dark (admin only).
                      </p>
                    </div>
                    <ThemeToggle />
                  </div>

                  <div>
                    <DemoLabel>Live surfaces (change with admin theme)</DemoLabel>
                    <SurfaceTokenGrid tokens={LIVE_SURFACE_TOKENS.slice(0, 4)} />
                  </div>

                  <DemoNote>
                    <p className="font-medium text-foreground">
                      Quick checklist
                    </p>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                      <li>Background / card / muted look different</li>
                      <li>Primary readable (brown light · gold dark)</li>
                      <li>Theme toggle snaps instantly — no fade or flicker</li>
                      <li>Forms, focus rings, and labels stay clear</li>
                      <li>Brand hex swatches in Colors stay fixed (docs)</li>
                    </ol>
                  </DemoNote>
                </div>
              </DesignSection>
            </motion.div>

            {/* Principles */}
            <motion.div variants={staggerItem}>
              <DesignSection
                id="principles"
                title="Design Principles"
                description="Non-negotiable rules. Admin supports light/dark; the public website is light-only and branded via Appearance."
              >
                <div className="space-y-6">
                  <DemoNote>
                    <p className="font-medium text-foreground">
                      Hard rule: no gradients
                    </p>
                    <p className="mt-1.5">
                      Do not use linear, radial, or mesh gradients. Shells use
                      semantic tokens; light brand hexes (
                      {designPrinciples.tokens.primary},{" "}
                      {designPrinciples.tokens.cream}) are documentation only.
                    </p>
                  </DemoNote>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {designPrinciples.pillars.map((pillar) => (
                      <Card key={pillar.title} className="shadow-none">
                        <CardHeader className="pb-2">
                          <CardTitle>{pillar.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {pillar.description}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="shadow-none">
                      <CardHeader>
                        <CardTitle className="text-emerald-800 dark:text-emerald-400">
                          Do
                        </CardTitle>
                        <CardDescription>
                          Default patterns for every screen.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <PrincipleList tone="do" groups={designPrinciples.do} />
                      </CardContent>
                    </Card>
                    <Card className="shadow-none">
                      <CardHeader>
                        <CardTitle className="text-red-600 dark:text-red-400">
                          Don&apos;t
                        </CardTitle>
                        <CardDescription>
                          Reject these even on marketing or auth screens.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <PrincipleList
                          tone="dont"
                          groups={designPrinciples.dont}
                        />
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <DemoLabel>Token references</DemoLabel>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      {(
                        [
                          ["Primary", designPrinciples.tokens.primary],
                          ["Cream", designPrinciples.tokens.cream],
                          ["Border", designPrinciples.tokens.border],
                          ["Accent", designPrinciples.tokens.accent],
                          ["Radius", designPrinciples.tokens.radius],
                          ["Spacing", designPrinciples.tokens.spacing],
                        ] as const
                      ).map(([name, value]) => (
                        <div
                          key={name}
                          className="rounded-xl border border-border bg-card px-3 py-3"
                        >
                          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            {name}
                          </p>
                          <p className="mt-1 font-mono text-xs text-foreground">
                            {value}
                          </p>
                          {value.startsWith("#") ? (
                            <div
                              className="mt-2 h-8 rounded-lg border border-border"
                              style={{ backgroundColor: value }}
                              aria-hidden
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </DesignSection>
            </motion.div>

            {/* Colors */}
            <motion.div variants={staggerItem}>
              <DesignSection
                id="colors"
                title="Color System"
                description="Fixed light-brand hexes for documentation. Runtime UI should prefer semantic tokens from Theme / Surfaces."
              >
                <div className="space-y-6">
                  <DemoNote>
                    These swatches do{" "}
                    <span className="font-medium text-foreground">not</span>{" "}
                    change with dark mode. They document the light brand palette.
                  </DemoNote>

                  <div>
                    <DemoLabel>Brand palette</DemoLabel>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <ColorSwatch name="White" value={brandColors.white} description="Docs reference" />
                      <ColorSwatch name="Cream" value={brandColors.cream} description="Docs reference" />
                      <ColorSwatch name="Beige" value={brandColors.beige} description="Docs reference" />
                      <ColorSwatch name="Border" value={brandColors.border} description="Light border" />
                      <ColorSwatch name="Accent" value={brandColors.accent} description="Gold / dark primary" />
                      <ColorSwatch name="Primary" value={brandColors.primary} onDarkSwatch description="Light brand brown" />
                      <ColorSwatch name="Secondary" value={brandColors.secondary} onDarkSwatch description="Light hover brown" />
                      <ColorSwatch name="Text" value={brandColors.text} onDarkSwatch description="Light body text" />
                    </div>
                  </div>

                  <div>
                    <DemoLabel>Brown scale</DemoLabel>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {Object.entries(bakeryColors.brown).map(([shade, hex]) => (
                        <ColorSwatch
                          key={shade}
                          name={shade}
                          value={hex}
                          onDarkSwatch={Number(shade) >= 500}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <DemoLabel>Status badges</DemoLabel>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="success">Published</Badge>
                      <Badge variant="warning">Draft</Badge>
                      <Badge variant="destructive">Archived</Badge>
                      <Badge variant="accent">Featured</Badge>
                    </div>
                  </div>
                </div>
              </DesignSection>
            </motion.div>

            {/* Typography */}
            <motion.div variants={staggerItem}>
              <DesignSection
                id="typography"
                title="Typography"
                description="Plus Jakarta Sans for headings, Inter for body. One hierarchy — use presets, don’t invent sizes."
              >
                <Card className="shadow-none">
                  <CardContent className="space-y-0 divide-y divide-border p-0">
                    {TYPE_SAMPLES.map((row) => (
                      <div
                        key={row.label}
                        className="grid gap-3 px-5 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6 sm:px-6"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-foreground">
                            {row.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.note}
                          </p>
                        </div>
                        <p
                          className={cn(
                            row.className,
                            "min-w-0 break-words",
                            row.label === "Display" &&
                              "text-3xl sm:text-4xl lg:text-5xl",
                            row.label.startsWith("Body") ||
                              row.label === "Caption" ||
                              row.label === "Overline"
                              ? undefined
                              : "text-foreground"
                          )}
                        >
                          {row.sample}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </DesignSection>
            </motion.div>

            {/* Spacing */}
            <motion.div variants={staggerItem}>
              <DesignSection
                id="spacing"
                title="Spacing"
                description="8px grid. Prefer gap / space-y tokens over one-off pixel values."
              >
                <div className="space-y-6">
                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle>Scale</CardTitle>
                      <CardDescription>
                        Multiples of 4–8px used across admin and storefront.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                        {spacingScale.map((px) => (
                          <div
                            key={px}
                            className="flex flex-col items-center gap-2"
                          >
                            <div
                              className="rounded-md bg-primary"
                              style={{ width: px, height: px }}
                              aria-hidden
                            />
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {px}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle>Usage</CardTitle>
                      <CardDescription>
                        Common layout rhythm for this product.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[28rem] text-left text-sm">
                          <thead>
                            <tr className="border-b border-border text-muted-foreground">
                              <th className="pb-3 pr-4 font-medium">Use</th>
                              <th className="pb-3 pr-4 font-medium">Size</th>
                              <th className="pb-3 font-medium">Token</th>
                            </tr>
                          </thead>
                          <tbody>
                            {SPACING_USAGE.map((row) => (
                              <tr
                                key={row.name}
                                className="border-b border-border last:border-0"
                              >
                                <td className="py-3 pr-4 font-medium text-foreground">
                                  {row.name}
                                </td>
                                <td className="py-3 pr-4 font-mono text-xs text-foreground">
                                  {row.value}
                                </td>
                                <td className="max-w-[16rem] truncate py-3 font-mono text-xs text-muted-foreground">
                                  {row.token}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-4 text-xs text-muted-foreground">
                        Page sections use{" "}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                          space-y-16
                        </code>
                        ; inside sections use{" "}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                          space-y-6
                        </code>
                        ; grids use{" "}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                          gap-4
                        </code>
                        .
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </DesignSection>
            </motion.div>

            {/* Buttons */}
            <motion.div variants={staggerItem}>
              <DesignSection
                id="buttons"
                title="Buttons"
                description="Primary follows theme (brown light / gold dark). Bakery stays solid brown in both modes."
              >
                <Card className="shadow-none">
                  <CardContent className="space-y-6 pt-6">
                    <div>
                      <DemoLabel>Variants</DemoLabel>
                      <div className="flex flex-wrap gap-3">
                        <Button>Primary</Button>
                        <Button variant="bakery">Bakery</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="cream">Muted</Button>
                        <Button variant="accent">Accent</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="destructive">Destructive</Button>
                        <Button variant="link">Link</Button>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Primary = theme token · Bakery = solid brown both modes
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <DemoLabel>Sizes</DemoLabel>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button size="xs">Extra Small</Button>
                        <Button size="sm">Small</Button>
                        <Button size="default">Default</Button>
                        <Button size="lg">Large</Button>
                        <Button size="icon" aria-label="Favorite">
                          <Star className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <DemoLabel>States</DemoLabel>
                      <div className="flex flex-wrap gap-3">
                        <Button disabled>Disabled</Button>
                        <Button variant="outline" disabled>
                          Disabled outline
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </DesignSection>
            </motion.div>

            {/* Forms */}
            <motion.div variants={staggerItem}>
              <DesignSection
                id="forms"
                title="Form Elements"
                description="Labels, borders, and focus rings must stay clear in light and dark."
              >
                <Card className="shadow-none">
                  <CardContent className="grid gap-6 pt-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ds-email">Email</Label>
                      <Input
                        id="ds-email"
                        type="email"
                        defaultValue="admin@bakery.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ds-search">Search</Label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="ds-search"
                          className="pl-9"
                          placeholder="Search cakes..."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ds-error">Invalid field</Label>
                      <Input
                        id="ds-error"
                        aria-invalid
                        defaultValue="bad@"
                      />
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">
                        Enter a valid email
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ds-disabled">Disabled</Label>
                      <Input
                        id="ds-disabled"
                        disabled
                        defaultValue="Unavailable"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="ds-terms" defaultChecked />
                      <Label htmlFor="ds-terms">Remember me</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="ds-featured" defaultChecked />
                      <Label htmlFor="ds-featured">Featured cake</Label>
                    </div>
                    <div className="space-y-3 sm:col-span-2">
                      <Label>Delivery option</Label>
                      <RadioGroup
                        defaultValue="pickup"
                        className="flex flex-wrap gap-4"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="pickup" id="ds-pickup" />
                          <Label htmlFor="ds-pickup">Store pickup</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="delivery" id="ds-delivery" />
                          <Label htmlFor="ds-delivery">Home delivery</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </CardContent>
                </Card>
              </DesignSection>
            </motion.div>

            {/* Cards */}
            <motion.div variants={staggerItem}>
              <DesignSection
                id="cards"
                title="Cards & Badges"
                description="Cards use bg-card + border. Muted surfaces keep foreground text readable."
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Card className="shadow-none">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle>Chocolate Truffle</CardTitle>
                        <Badge variant="accent">Featured</Badge>
                      </div>
                      <CardDescription>
                        Rich dark chocolate layers
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-background">
                        <Cake
                          className="size-10 text-foreground/45"
                          aria-hidden
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="justify-between">
                      <span className="font-semibold text-primary">₹1,299</span>
                      <Button size="sm">View</Button>
                    </CardFooter>
                  </Card>

                  <Card className="bg-muted text-foreground shadow-none">
                    <CardHeader>
                      <CardTitle className="text-foreground">
                        Muted surface
                      </CardTitle>
                      <CardDescription className="text-foreground/70">
                        Section alternate — muted token
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground/70">
                        Use for grouping without heavy shadows. Readable in
                        light and dark.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle>Badge variants</CardTitle>
                      <CardDescription>
                        Status chips with dark-mode pairs
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Badge>Default</Badge>
                      <Badge variant="secondary">Secondary</Badge>
                      <Badge variant="bakery">Bakery</Badge>
                      <Badge variant="accent">Accent</Badge>
                      <Badge variant="success">Success</Badge>
                      <Badge variant="warning">Warning</Badge>
                      <Badge variant="destructive">Error</Badge>
                      <Badge variant="outline">Outline</Badge>
                    </CardContent>
                  </Card>
                </div>
              </DesignSection>
            </motion.div>

            {/* Feedback */}
            <motion.div variants={staggerItem}>
              <DesignSection
                id="feedback"
                title="Feedback & States"
                description="Dialogs, toasts, skeletons, and empty states."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle>Interactive</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                      <Dialog>
                        <DialogTrigger render={<Button variant="outline" />}>
                          Confirm Delete
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete cake?</DialogTitle>
                            <DialogDescription>
                              This action cannot be undone. The cake will be
                              permanently removed from your catalog.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline">Cancel</Button>
                            <Button variant="destructive">Delete</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="bakery"
                        onClick={() =>
                          toast.success("Cake saved successfully", {
                            description: "Your changes are ready to publish.",
                          })
                        }
                      >
                        Show Toast
                      </Button>
                      <Tooltip>
                        <TooltipTrigger
                          render={<Button variant="ghost" size="icon" />}
                        >
                          <Bell className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent>3 new inquiries</TooltipContent>
                      </Tooltip>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle>Loading</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-24 w-full rounded-xl" />
                    </CardContent>
                  </Card>

                  <Card className="shadow-none sm:col-span-2">
                    <CardHeader>
                      <CardTitle>Empty state</CardTitle>
                      <CardDescription>
                        Used across admin list pages
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-4 py-12 text-center">
                        <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-border bg-card text-foreground">
                          <Search className="size-5" />
                        </div>
                        <p className="font-medium text-foreground">
                          No cakes yet
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                          Get started by adding your first cake to the catalog.
                        </p>
                        <Button className="mt-4" size="sm">
                          Add Cake
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none sm:col-span-2">
                    <CardHeader>
                      <CardTitle>Accordion</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Accordion defaultValue={["item-1"]}>
                        <AccordionItem value="item-1">
                          <AccordionTrigger>
                            What makes our cakes special?
                          </AccordionTrigger>
                          <AccordionContent>
                            Premium ingredients sourced locally, with recipes
                            perfected over decades of craftsmanship.
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                          <AccordionTrigger>
                            Do you offer custom wedding cakes?
                          </AccordionTrigger>
                          <AccordionContent>
                            Yes. Our wedding cake studio creates bespoke designs
                            tailored to your celebration.
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </div>
              </DesignSection>
            </motion.div>

            {/* Navigation */}
            <motion.div variants={staggerItem}>
              <DesignSection
                id="navigation"
                title="Navigation"
                description="Breadcrumbs, tabs, pagination — admin patterns."
              >
                <Card className="shadow-none">
                  <CardContent className="space-y-8 pt-6">
                    <div>
                      <DemoLabel>Breadcrumb</DemoLabel>
                      <Breadcrumb>
                        <BreadcrumbList>
                          <BreadcrumbItem>
                            <BreadcrumbLink href="#">
                              <Home className="size-3.5" />
                            </BreadcrumbLink>
                          </BreadcrumbItem>
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            <BreadcrumbLink href="#">Cakes</BreadcrumbLink>
                          </BreadcrumbItem>
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            <BreadcrumbPage>Chocolate Truffle</BreadcrumbPage>
                          </BreadcrumbItem>
                        </BreadcrumbList>
                      </Breadcrumb>
                    </div>

                    <div>
                      <DemoLabel>Tabs</DemoLabel>
                      <Tabs defaultValue="all">
                        <TabsList>
                          <TabsTrigger value="all">All Cakes</TabsTrigger>
                          <TabsTrigger value="featured">Featured</TabsTrigger>
                          <TabsTrigger value="wedding">Wedding</TabsTrigger>
                        </TabsList>
                        <TabsContent
                          value="all"
                          className="mt-3 text-sm text-muted-foreground"
                        >
                          24 cakes in catalog
                        </TabsContent>
                        <TabsContent
                          value="featured"
                          className="mt-3 text-sm text-muted-foreground"
                        >
                          8 featured cakes
                        </TabsContent>
                        <TabsContent
                          value="wedding"
                          className="mt-3 text-sm text-muted-foreground"
                        >
                          12 wedding cakes
                        </TabsContent>
                      </Tabs>
                    </div>

                    <div>
                      <DemoLabel>Profile + pagination</DemoLabel>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-muted text-foreground">
                              <User className="size-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Admin User
                            </p>
                            <p className="text-xs text-muted-foreground">
                              admin@bakery.com
                            </p>
                          </div>
                        </div>
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious href="#" />
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationLink href="#" isActive>
                                1
                              </PaginationLink>
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationLink href="#">2</PaginationLink>
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                            <PaginationItem>
                              <PaginationNext href="#" />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </DesignSection>
            </motion.div>

            {/* Surfaces */}
            <motion.div variants={staggerItem}>
              <DesignSection
                id="surfaces"
                title="Surfaces"
                description="Live theme surfaces change with light/dark. Brand hexes below are documentation-only."
              >
                <div className="space-y-6">
                  <div>
                    <DemoLabel>Live theme tokens</DemoLabel>
                    <SurfaceTokenGrid tokens={LIVE_SURFACE_TOKENS} />
                  </div>

                  <div>
                    <DemoLabel>
                      Fixed brand surfaces (always on light paper)
                    </DemoLabel>
                    <div className="rounded-2xl border border-border bg-white p-4 sm:p-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {Object.entries(surfaces).map(([name, hex]) => (
                          <div
                            key={name}
                            className="rounded-xl border border-neutral-200 p-5"
                            style={{ backgroundColor: hex, color: "#171717" }}
                          >
                            <p className="text-sm font-medium capitalize">
                              {name}
                            </p>
                            <p
                              className="mt-1 font-mono text-xs"
                              style={{ color: "#525252" }}
                            >
                              {hex}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      White board keeps light hexes readable while the page is
                      in dark mode.
                    </p>
                  </div>
                </div>
              </DesignSection>
            </motion.div>

            <motion.footer
              variants={staggerItem}
              className="rounded-2xl border border-border bg-card p-8 text-center"
            >
              <div className="mx-auto flex max-w-md flex-col items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary">
                  <Check className="size-5 text-primary-foreground" />
                </div>
                <h3 className={cn(typographyPresets.h4, "text-foreground")}>
                  Design system ready
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Principles, theme tokens, and components are aligned for light
                  and dark. Use this page as the visual source of truth.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button render={<a href={routes.admin.dashboard} />}>
                    View Admin
                  </Button>
                  <Button variant="outline" render={<a href={routes.home} />}>
                    <Home className="size-4" />
                    Home
                  </Button>
                </div>
              </div>
            </motion.footer>
          </motion.main>
        </div>
      </div>
    </div>
  );
}
