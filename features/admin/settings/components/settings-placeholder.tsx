"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, type LucideIcon } from "lucide-react";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/constants/routes";

interface SettingsPlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /** What this page will manage once the backend is wired. */
  features: string[];
  /** ReactNode so a placeholder can point at the page that covers it today. */
  note?: React.ReactNode;
}

/**
 * Reusable "planned settings page" — lists what the section will do. Frontend only;
 * activation happens when the backend is added.
 */
export function SettingsPlaceholder({
  title,
  description,
  icon: Icon,
  features,
  note = "This configuration is frontend-ready — it activates once the backend is connected.",
}: SettingsPlaceholderProps) {
  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title={title}
        description={description}
        actions={
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            render={<Link href={routes.admin.settings.overview} />}
          >
            <ArrowLeft className="size-4" />
            All settings
          </Button>
        }
      />

      <Card className="shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
              <Icon className="size-6" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-lg font-bold text-foreground">{title}</h2>
                <Badge variant="outline" className="text-[10px]">Coming soon</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What you&apos;ll manage here
            </p>
            <ul className="mt-3 space-y-2.5">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-bakery-700" />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-muted p-4 text-xs text-muted-foreground">
            {note}
          </div>
        </CardContent>
      </Card>
    </AdminPage>
  );
}
