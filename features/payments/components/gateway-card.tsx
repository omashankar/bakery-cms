"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Settings2 } from "lucide-react";
import type { PaymentGatewayConfig } from "@/features/payments/registry/gateways";
import type {
  ConnectionStatus,
  GatewayMode,
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
  onModeChange: (mode: GatewayMode) => void;
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
  onModeChange,
}: GatewayCardProps) {
  const statusMeta = STATUS_META[status];
  const showMode = config.category === "online";

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-colors",
        runtime.enabled ? "border-bakery-700/40" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <GatewayLogo mark={config.mark} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading font-bold text-foreground">{config.name}</h3>
              {config.isCore ? (
                <Badge variant="accent" className="text-[10px]">Core</Badge>
              ) : null}
            </div>
            <p className="text-xs capitalize text-muted-foreground">{config.category}</p>
          </div>
        </div>
        <Switch
          checked={runtime.enabled}
          onCheckedChange={onToggle}
          aria-label={`Enable ${config.name}`}
        />
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{config.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
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

        {showMode ? (
          <div className="inline-flex overflow-hidden rounded-lg border border-border text-[11px]">
            {(["test", "live"] as GatewayMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onModeChange(mode)}
                className={cn(
                  "px-2.5 py-1 font-medium capitalize transition-colors",
                  runtime.mode === mode
                    ? "bg-bakery-700 text-white"
                    : "bg-white text-muted-foreground hover:bg-cream-100"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {config.supportedCurrencies.slice(0, 4).map((cur) => (
          <span
            key={cur}
            className="rounded-md border border-border bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
          >
            {cur}
          </span>
        ))}
        <span className="rounded-md border border-border bg-white px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {config.supportedCountries.slice(0, 3).join(" · ")}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          Priority {runtime.priority} · {config.processingTime}
        </span>
        <Button
          variant="outline"
          size="sm"
          render={<Link href={routes.admin.commerce.gateway(config.id)} />}
        >
          <Settings2 className="size-4" />
          Configure
        </Button>
      </div>
    </div>
  );
}
