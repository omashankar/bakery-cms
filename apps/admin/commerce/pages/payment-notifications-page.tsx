"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  Bell,
  CheckCircle2,
  CreditCard,
  FileText,
  RotateCcw,
  ServerCrash,
  Users,
  XCircle,
} from "lucide-react";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import {
  CHANNEL_LABELS,
  PAYMENT_NOTIFICATION_TEMPLATES,
  type NotifAudience,
  type NotifChannel,
  type NotifIcon,
  type NotificationTemplate,
} from "@/features/payments/registry/notification-templates";
import {
  getNotificationPref,
  NOTIF_PREFS_UPDATED_EVENT,
  setNotificationEnabled,
  toggleNotificationChannel,
} from "@/features/payments/lib/notification-prefs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { reportWrite } from "@/apps/admin/lib/report-write";

const ICONS: Record<NotifIcon, typeof Bell> = {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Banknote,
  FileText,
  CreditCard,
  ServerCrash,
};

const CHANNELS: NotifChannel[] = ["in_app", "email", "whatsapp"];

/**
 * The events that have a sender behind them today.
 *
 * The other five are defined here, shown with a sample message, and produced
 * by no code path at all — there is no payment-failed email anywhere, and the
 * only refund mail goes out on COMPLETION, not on initiation. Saying so beats
 * a switch that silently governs nothing.
 */
const WIRED_EVENTS = new Set([
  "cust_payment_success",
  "cust_refund_completed",
  "cust_invoice_generated",
  "admin_payment_received",
  "admin_payment_failed",
  "admin_cod_confirmation",
]);

function TemplateRow({ template }: { template: NotificationTemplate }) {
  const [pref, setPref] = useState(() => getNotificationPref(template.id));

  useEffect(() => {
    const refresh = () => setPref(getNotificationPref(template.id));
    window.addEventListener(NOTIF_PREFS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(NOTIF_PREFS_UPDATED_EVENT, refresh);
  }, [template.id]);

  const Icon = ICONS[template.icon];

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cream-100 text-bakery-700">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {template.event}
              {WIRED_EVENTS.has(template.id) ? null : (
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium normal-case text-muted-foreground">
                  no sender yet
                </span>
              )}
            </p>
            <p className="mt-0.5 font-medium text-foreground">{template.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{template.message}</p>
          </div>
        </div>
        <Switch
          checked={pref.enabled}
          onCheckedChange={(v) => {
            // These decide which alerts the team receives, and the sender reads
            // the server copy — a local-only toggle silences nothing.
            void setNotificationEnabled(template.id, v).then((persisted) =>
              reportWrite(persisted, v ? "Notification enabled" : "Notification disabled")
            );
          }}
          aria-label={`Enable ${template.event}`}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">Channels:</span>
        {CHANNELS.map((channel) => {
          const active = pref.channels.includes(channel);
          return (
            <button
              key={channel}
              type="button"
              disabled={!pref.enabled}
              onClick={() => {
                void toggleNotificationChannel(template.id, channel).then((persisted) =>
                  reportWrite(persisted, `${channel} channel updated`)
                );
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
                active
                  ? "border-bakery-700 bg-cream-50 text-bakery-700"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {CHANNEL_LABELS[channel]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PaymentNotificationsPage() {
  const groups: { audience: NotifAudience; label: string; icon: typeof Bell }[] = [
    { audience: "customer", label: "Customer notifications", icon: Users },
    { audience: "admin", label: "Admin notifications", icon: Bell },
  ];

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Payment Notifications"
        description="Choose which payment events notify customers and your team, and how."
      />

      <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
        {/* This said "Actual sending is wired when the backend is added", while
            the page header promised the switches chose what notifies customers
            — so the same screen both claimed and denied that they worked. The
            email switches are read by the senders now; the events without one
            are labelled rather than left looking live. */}
        Email notifications follow these switches. In-app notifications appear in
        the bell menu. Events marked <em>no sender yet</em> are defined but not
        produced by anything, so their switches have nothing to govern.
      </div>

      {groups.map((group) => {
        const templates = PAYMENT_NOTIFICATION_TEMPLATES.filter((t) => t.audience === group.audience);
        return (
          <Card key={group.audience} className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <group.icon className="size-4 text-bakery-700" />
                {group.label}
                <span className="text-sm font-normal text-muted-foreground">
                  ({templates.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.map((template) => (
                <TemplateRow key={template.id} template={template} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </AdminPage>
  );
}
