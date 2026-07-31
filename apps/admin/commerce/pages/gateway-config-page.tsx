"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { reportWrite } from "@/apps/admin/lib/report-write";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { getGatewayConfig } from "@/features/payments/registry/gateways";
import {
  getGatewayRuntime,
  setGatewayEnabled,
} from "@/features/payments/lib/payment-gateway-settings";
import { GatewayLogo } from "@/features/payments/components/gateway-logo";
import {
  RazorpayKeysForm,
  type RazorpayStatus,
} from "@/apps/admin/commerce/components/razorpay-keys-card";
import { GatewayCredentialsForm } from "@/apps/admin/commerce/components/gateway-credentials-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { routes } from "@/constants/routes";

interface GatewayConfigPageProps {
  gatewayId: string;
}

export function GatewayConfigPage({ gatewayId }: GatewayConfigPageProps) {
  const config = getGatewayConfig(gatewayId);
  const [enabled, setEnabled] = useState(false);
  // Reported up by the Razorpay form so the card header can show one badge,
  // instead of the form drawing a second one inside its own card.
  const [razorpayStatus, setRazorpayStatus] = useState<RazorpayStatus | null>(null);

  useEffect(() => {
    if (!config) return;
    const runtime = getGatewayRuntime(config.id);
    setEnabled(runtime.enabled);
  }, [config]);

  if (!config) return notFound();

  const isRazorpay = config.id === "razorpay";
  // Can this gateway actually charge anyone? Ten of twelve cannot.
  const wired = config.isCore === true;

  // Which gateway is on — this decides how customers pay, and checkout reads the
  // SERVER copy. A local-only change means the admin believes they switched
  // gateways and nothing switched.
  async function handleToggle(next: boolean) {
    setEnabled(next);
    reportWrite(
      await setGatewayEnabled(config!.id, next),
      next ? "Gateway enabled" : "Gateway disabled"
    );
  }

  const statusBadge = !wired ? (
    <Badge variant="outline" className="shrink-0">
      Not available yet
    </Badge>
  ) : isRazorpay && razorpayStatus ? (
    !razorpayStatus.configured ? (
      <Badge className="shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        No keys
      </Badge>
    ) : razorpayStatus.verified === true ? (
      <Badge variant="accent" className="shrink-0">
        Connected{razorpayStatus.testMode === true ? " · Test" : razorpayStatus.testMode === false ? " · Live" : ""}
      </Badge>
    ) : razorpayStatus.verified === false ? (
      <Badge variant="destructive" className="shrink-0">
        Keys rejected
      </Badge>
    ) : (
      <Badge variant="outline" className="shrink-0">
        Unverified
      </Badge>
    )
  ) : null;

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title={config.name}
        description={config.description}
        actions={
          <Button variant="outline" render={<Link href={routes.admin.commerce.gateways} />}>
            <ArrowLeft className="size-4" />
            All gateways
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Config */}
        <div className="space-y-4">
          {/*
            ONE card for the whole connection: name, status, switch and the
            credential fields. The keys form used to render its own Card in here,
            so this page showed a card inside a card — two borders, two headings,
            and the connection state said twice in two different vocabularies.
          */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <GatewayLogo mark={config.mark} size="md" />
                <div>
                  <CardTitle className="text-base">Connection</CardTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {!wired
                      ? "Not available yet"
                      : enabled
                        ? "Enabled at checkout"
                        : "Disabled — customers will not see it"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge}
                <Switch
                  checked={wired && enabled}
                  onCheckedChange={handleToggle}
                  disabled={!wired}
                  aria-label="Enable gateway"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!wired ? (
                // The honest state for ten of the twelve entries in this
                // catalogue. Only Razorpay and COD reach a customer: the
                // checkout renders exactly two methods. Every other card used to
                // offer a working-looking switch and a credentials form, so
                // pasting a live Stripe secret here looked identical to
                // connecting a payment method — and changed nothing.
                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="text-muted-foreground">
                    <p className="font-medium text-foreground">Not available yet</p>
                    <p className="mt-1">
                      {config.name} is not connected to a payment path, so it cannot take money
                      and does not appear at checkout. There is nothing to configure here yet —
                      entering keys would not make it work.
                    </p>
                    <p className="mt-2">
                      Today this shop can charge through{" "}
                      <Link href={routes.admin.commerce.gateway("razorpay")} className="font-medium text-bakery-700 hover:underline">
                        Razorpay
                      </Link>{" "}
                      and take Cash on Delivery.
                    </p>
                  </div>
                </div>
              ) : isRazorpay ? (
                // Razorpay keys, on the Razorpay page — their only home. This was
                // a notice saying "manage them from Payments → Payment Gateway",
                // a redirect served to someone already standing in the right
                // place; the Payments screen links HERE now.
                //
                // Its own form rather than the shared one below, because it has
                // three things nothing else does: environment-variable override,
                // a webhook secret, and a live connection check.
                <RazorpayKeysForm onStatusChange={setRazorpayStatus} />
              ) : config.configFields.length > 0 ? (
                // Every future gateway lands here. Registry-driven, so switching
                // one on needs no new screen — see GatewayCredentialsForm.
                <GatewayCredentialsForm config={config} />
              ) : (
                // COD: real, and nothing to configure. No keys, no gateway.
                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Nothing to configure — the customer pays the delivery rider in cash. Use the
                    switch above to offer it at checkout.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <Card className="h-fit shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <DetailRow label="Category" value={<span className="capitalize">{config.category}</span>} />
            <DetailRow label="Processing" value={config.processingTime} />
            <DetailRow
              label="Currencies"
              value={
                <div className="flex flex-wrap justify-end gap-1">
                  {config.supportedCurrencies.map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
              }
            />
            <DetailRow label="Countries" value={config.supportedCountries.join(", ")} />
            <DetailRow
              label="Methods"
              value={
                <div className="flex flex-wrap justify-end gap-1">
                  {config.supportedMethodIds.map((m) => (
                    <Badge key={m} variant="outline" className="text-[10px] capitalize">{m}</Badge>
                  ))}
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
