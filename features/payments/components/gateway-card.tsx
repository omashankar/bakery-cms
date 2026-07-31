"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Settings2 } from "lucide-react";
import type { PaymentGatewayConfig } from "@/features/payments/registry/gateways";
import type {
  ConnectionStatus,
  GatewayRuntime,
} from "@/features/payments/lib/payment-gateway-settings";
import { GatewayLogo } from "@/features/payments/components/gateway-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

interface GatewayCardProps {
  config: PaymentGatewayConfig;
  runtime: GatewayRuntime;
  status: ConnectionStatus;
  onToggle: (enabled: boolean) => void;
}

const STATUS_META: Record<ConnectionStatus, { label: string; className: string }> = {
  connected: { label: "Connected", className: "bg-green-100 text-green-800" },
  configured: { label: "Configured", className: "bg-green-100 text-green-800" },
  ready: { label: "Ready", className: "bg-cream-100 text-bakery-700" },
  not_configured: { label: "Not configured", className: "bg-amber-100 text-amber-800" },
};

export function GatewayCard({
  config,
  runtime,
  status,
  onToggle,
}: GatewayCardProps) {
  const statusMeta = STATUS_META[status];
  const wired = config.isCore === true;

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-colors",
        !wired ? "border-dashed border-border opacity-70" : null,
        wired && runtime.enabled ? "border-bakery-700/40" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <GatewayLogo mark={config.mark} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading font-bold text-foreground">{config.name}</h3>
            </div>
            <p className="text-xs capitalize text-muted-foreground">{config.category}</p>
          </div>
        </div>
        {/*
          A switch that cannot do anything must not look like one it can. This
          was live for every gateway, so turning Stripe "on" read exactly like
          turning Razorpay on — and did nothing at all, because the checkout can
          only render Razorpay and COD.
        */}
        <Switch
          checked={wired && runtime.enabled}
          onCheckedChange={onToggle}
          disabled={!wired}
          aria-label={wired ? `Enable ${config.name}` : `${config.name} is not available yet`}
        />
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{config.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {wired ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              statusMeta.className
            )}
          >
            {status === "connected" || status === "configured" || status === "ready" ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <Circle className="size-3" />
            )}
            {statusMeta.label}
          </span>
        ) : (
          <Badge variant="outline" className="text-[11px] font-medium">
            Not available yet
          </Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {config.supportedCurrencies.slice(0, 4).map((cur) => (
          <span
            key={cur}
            className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
          >
            {cur}
          </span>
        ))}
        <span className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {config.supportedCountries.slice(0, 3).join(" · ")}
        </span>
      </div>

      {/* mt-auto pins the footer to the bottom of the stretched card so the
          Configure row lines up across every card in a grid row. */}
      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">
            {config.processingTime}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            render={<Link href={routes.admin.commerce.gateway(config.id)} />}
          >
            <Settings2 className="size-4" />
            {wired ? "Configure" : "Details"}
          </Button>
        </div>
      </div>
    </div>
  );
}
