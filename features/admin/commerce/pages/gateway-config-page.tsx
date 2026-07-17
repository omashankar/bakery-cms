"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import { getGatewayConfig } from "@/features/payments/registry/gateways";
import {
  getGatewayRuntime,
  saveGatewayCredentials,
  setGatewayEnabled,
  setGatewayMode,
  type GatewayMode,
} from "@/features/payments/lib/payment-gateway-settings";
import { GatewayLogo } from "@/features/payments/components/gateway-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

interface GatewayConfigPageProps {
  gatewayId: string;
}

export function GatewayConfigPage({ gatewayId }: GatewayConfigPageProps) {
  const config = getGatewayConfig(gatewayId);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<GatewayMode>("test");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!config) return;
    const runtime = getGatewayRuntime(config.id);
    setEnabled(runtime.enabled);
    setMode(runtime.mode);
    setCreds(runtime.credentials);
    setMounted(true);
  }, [config]);

  if (!config) return notFound();

  const isRazorpay = config.id === "razorpay";

  function handleToggle(next: boolean) {
    setEnabled(next);
    setGatewayEnabled(config!.id, next);
  }
  function handleMode(next: GatewayMode) {
    setMode(next);
    setGatewayMode(config!.id, next);
  }
  function handleSave() {
    saveGatewayCredentials(config!.id, creds);
    toast.success("Gateway settings saved", {
      description: "Placeholder config — backend integration wires this later.",
    });
  }

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
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <GatewayLogo mark={config.mark} size="md" />
                <div>
                  <CardTitle className="text-base">Connection</CardTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {enabled ? "Enabled at checkout" : "Disabled"}
                  </p>
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={handleToggle} aria-label="Enable gateway" />
            </CardHeader>
            <CardContent className="space-y-4">
              {config.category === "online" ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Environment</span>
                  <div className="inline-flex overflow-hidden rounded-lg border border-border text-xs">
                    {(["test", "live"] as GatewayMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMode(m)}
                        className={cn(
                          "px-3 py-1.5 font-medium capitalize transition-colors",
                          mode === m
                            ? "bg-bakery-700 text-white"
                            : "bg-card text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {m} mode
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {isRazorpay ? (
                <div className="flex items-start gap-2 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0 text-bakery-700" />
                  <p>
                    Razorpay keys are managed securely on the server. Add or update them from{" "}
                    <Link href={routes.admin.commerce.payments} className="font-medium text-bakery-700 hover:underline">
                      Payments → Payment Gateway
                    </Link>{" "}
                    (keys never touch the browser).
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {config.configFields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key}>
                          {field.label}
                          {field.required ? <span className="text-destructive"> *</span> : null}
                        </Label>
                        <Input
                          id={field.key}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={creds[field.key] ?? ""}
                          onChange={(e) =>
                            setCreds((c) => ({ ...c, [field.key]: e.target.value }))
                          }
                          autoComplete="off"
                          disabled={!mounted}
                        />
                        {field.helper ? (
                          <p className="text-xs text-muted-foreground">{field.helper}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="bakery" onClick={handleSave}>
                      Save settings
                    </Button>
                    {config.docsUrl ? (
                      <Button variant="ghost" render={<a href={config.docsUrl} target="_blank" rel="noopener noreferrer" />}>
                        <ExternalLink className="size-4" />
                        Get keys
                      </Button>
                    ) : null}
                  </div>
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    Configuration is a frontend placeholder. Real processing is wired when the
                    backend is added.
                  </p>
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
