import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
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

export type RouteGroup = "landing" | "storefront" | "auth" | "admin" | "system";

const groupLabels: Record<RouteGroup, string> = {
  landing: "Landing Page",
  storefront: "Public Website",
  auth: "Authentication",
  admin: "Admin CMS",
  system: "System",
};

const groupColors: Record<RouteGroup, string> = {
  landing: "bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300",
  storefront: "bg-bakery-100 text-bakery-800 dark:bg-bakery-900/50 dark:text-bakery-200",
  auth: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  admin: "bg-secondary text-secondary-foreground",
  system: "bg-muted text-muted-foreground",
};

interface RoutePlaceholderProps {
  title: string;
  description?: string;
  phase: number;
  group: RouteGroup;
  path: string;
  className?: string;
}

export function RoutePlaceholder({
  title,
  description,
  phase,
  group,
  path,
  className,
}: RoutePlaceholderProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-4 py-16",
        className
      )}
    >
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
            <Construction className="size-6 text-muted-foreground" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge className={groupColors[group]}>{groupLabels[group]}</Badge>
            <Badge variant="outline">Phase {phase}</Badge>
          </div>
          <CardTitle className="font-heading text-xl">{title}</CardTitle>
          <CardDescription>
            {description ?? "This screen will be built in a future phase."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <code className="inline-block rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
            {path}
          </code>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" render={<Link href={routes.home} />}>
              <ArrowLeft className="size-3.5" />
              Architecture Hub
            </Button>
            <Button variant="bakery" size="sm" render={<Link href={routes.designSystem} />}>
              Design System
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
