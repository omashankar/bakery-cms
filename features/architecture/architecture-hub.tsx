import Link from "next/link";
import { ArrowRight, FolderTree } from "lucide-react";
import { BakeryCmsBrand } from "@/components/shared/bakery-cms-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

interface RouteGroupCard {
  title: string;
  description: string;
  phase: number;
  badge: string;
  badgeClass: string;
  links: { label: string; href: string }[];
}

const routeGroups: RouteGroupCard[] = [
  {
    title: "Design System",
    description: "Colors, typography, components, and motion tokens.",
    phase: 1,
    badge: "Complete",
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    links: [{ label: "Design System", href: routes.designSystem }],
  },
  {
    title: "Public Website",
    description: "Customer-facing bakery storefront with full page flows.",
    phase: 6,
    badge: "Complete",
    badgeClass: "bg-green-100 text-green-800",
    links: [
      { label: "Home", href: routes.store.home },
      { label: "Collections", href: routes.store.collections },
      { label: "Wedding Cakes", href: routes.store.weddingCakes },
      { label: "Contact", href: routes.store.contact },
      { label: "Gallery", href: routes.store.gallery },
    ],
  },
  {
    title: "Authentication",
    description: "Admin login flow with demo session and recovery screens.",
    phase: 7,
    badge: "Complete",
    badgeClass: "bg-green-100 text-green-800",
    links: [
      { label: "Login", href: routes.auth.login },
      { label: "Forgot Password", href: routes.auth.forgotPassword },
      { label: "OTP", href: routes.auth.otp },
    ],
  },
  {
    title: "Admin CMS",
    description: "Full admin panel — dashboard through settings, builders, and content modules.",
    phase: 20,
    badge: "Complete",
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    links: [
      { label: "Dashboard", href: routes.admin.dashboard },
      { label: "Cakes", href: routes.admin.cakes.list },
      { label: "Homepage Builder", href: routes.admin.builders.homepage },
      { label: "Media Library", href: routes.admin.media },
      { label: "Settings", href: routes.admin.settings.overview },
    ],
  },
];

const folderStructure = [
  "app/           → Next.js routes (route groups)",
  "components/    → Shared UI + shadcn components",
  "features/      → Feature modules (domain logic)",
  "layouts/       → Layout shells (admin, auth, store)",
  "hooks/         → Custom React hooks",
  "lib/           → Utilities (cn, motion, config)",
  "styles/        → CSS animations & tokens",
  "constants/     → Routes, navigation, design tokens",
  "types/         → TypeScript interfaces",
  "utils/         → Format, validation, slug helpers",
  "services/      → API placeholders (backend later)",
  "assets/        → Static images & media",
];

export function ArchitectureHub() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BakeryCmsBrand subtitle="Architecture Hub" size="md" />
          <div className="flex items-center gap-2">
            <Badge variant="accent">Phase 20</Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-10 space-y-3">
          <div className="flex items-center gap-2">
            <FolderTree className="size-5 text-gold-600" />
            <Badge variant="bakery">Folder Structure Ready</Badge>
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Project Architecture
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Scalable frontend structure with route groups, feature modules, layout
            shells, typed services, and placeholder pages for every screen.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {routeGroups.map((group) => (
            <Card key={group.title} className="hover-border">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="font-heading">{group.title}</CardTitle>
                    <CardDescription>{group.description}</CardDescription>
                  </div>
                  <Badge className={cn("shrink-0", group.badgeClass)}>
                    {group.badge}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {group.links.map((link) => (
                    <Button
                      key={link.href}
                      variant="outline"
                      size="sm"
                      render={<Link href={link.href} />}
                    >
                      {link.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="font-heading">Folder Structure</CardTitle>
            <CardDescription>
              Enterprise-grade architecture — frontend only, backend-ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-xl bg-muted/50 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {folderStructure.join("\n")}
            </pre>
          </CardContent>
        </Card>

        <div className="mt-8 flex justify-center">
          <Button variant="bakery" render={<Link href={routes.designSystem} />}>
            View Design System
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
