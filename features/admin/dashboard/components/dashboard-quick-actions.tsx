import Link from "next/link";
import {
  FolderOpen,
  MessageSquare,
  Package,
  Plus,
  Settings,
  ShoppingBag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

const quickActions = [
  { label: "Orders", href: routes.admin.orders.list, icon: ShoppingBag },
  { label: "Add Cake", href: routes.admin.cakes.add, icon: Plus },
  { label: "Inquiries", href: routes.admin.inquiries.overview, icon: MessageSquare },
  { label: "Inventory", href: routes.admin.commerce.inventory, icon: Package },
  { label: "Media", href: routes.admin.media, icon: FolderOpen },
  { label: "Settings", href: routes.admin.settings.overview, icon: Settings },
];

export function DashboardQuickActions() {
  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Shortcuts</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0">
        <div className="grid flex-1 grid-cols-2 content-start gap-2 sm:grid-cols-3 xl:grid-cols-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2",
                  "text-xs font-medium transition-premium hover:border-border hover:bg-muted"
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-card text-primary shadow-sm">
                  <Icon className="size-3.5" strokeWidth={1.75} />
                </span>
                <span className="truncate">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
