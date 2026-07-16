"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CreditCard,
  IndianRupee,
  Layers,
  Receipt,
  RotateCcw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { ensureDemoOrders } from "@/features/admin/commerce/lib/order-utils";
import { getOrders, type PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import { getPaymentAnalytics } from "@/features/payments/lib/payment-analytics";
import { RevenueChart } from "@/features/payments/components/revenue-chart";
import { PaymentMethodBreakdown } from "@/features/payments/components/payment-method-breakdown";
import { useCommerceSettingsForm } from "@/features/admin/commerce/lib/use-commerce-settings-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { routes } from "@/constants/routes";
import { formatCurrency } from "@/utils/format";

type GatewayStatus = {
  configured: boolean;
  keyId: string;
  source: "env" | "admin" | null;
  envLocked: boolean;
  testMode: boolean | null;
};

const methodOptions = [
  {
    key: "razorpay" as const,
    label: "Online Payment (Razorpay)",
    description: "Unified UPI, Cards, Netbanking & Wallets via Razorpay checkout.",
    icon: CreditCard,
  },
  {
    key: "cod" as const,
    label: "Cash on Delivery",
    description: "Customer pays when the order is delivered.",
    icon: Wallet,
  },
];

const quickLinks = [
  { href: routes.admin.commerce.gateways, label: "Gateways", icon: Layers },
  { href: routes.admin.commerce.transactions, label: "Transactions", icon: Receipt },
  { href: routes.admin.commerce.refunds, label: "Refunds", icon: RotateCcw },
];

export function PaymentsAdminPage() {
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [mounted, setMounted] = useState(false);
  const { settings, setSettings, isDirty, save } = useCommerceSettingsForm();

  // Razorpay connection (keys live on the server, never the browser).
  const [gateway, setGateway] = useState<GatewayStatus | null>(null);
  const [gwKeyId, setGwKeyId] = useState("");
  const [gwSecret, setGwSecret] = useState("");
  const [gwSaving, setGwSaving] = useState(false);

  useEffect(() => {
    ensureDemoOrders();
    setOrders(getOrders());
    setMounted(true);
    const refresh = () => setOrders(getOrders());
    window.addEventListener("bakery-orders-updated", refresh);

    fetch("/api/razorpay/config")
      .then((res) => res.json())
      .then((status: GatewayStatus) => {
        setGateway(status);
        setGwKeyId(status.keyId || "");
      })
      .catch(() => setGateway(null));

    return () => window.removeEventListener("bakery-orders-updated", refresh);
  }, []);

  const a = useMemo(() => getPaymentAnalytics(orders), [orders]);

  const enabledCount = [settings.paymentMethods.razorpay, settings.paymentMethods.cod].filter(
    Boolean
  ).length;

  function toggleMethod(key: "cod" | "razorpay", checked: boolean) {
    if (!checked && enabledCount <= 1 && settings.paymentMethods[key]) {
      toast.error("Keep at least one payment method enabled");
      return;
    }
    setSettings((prev) => ({
      ...prev,
      paymentMethods: { ...prev.paymentMethods, [key]: checked },
    }));
  }

  async function saveGateway() {
    if (!gwKeyId.trim() || !gwSecret.trim()) {
      toast.error("Enter both Key ID and Key Secret");
      return;
    }
    setGwSaving(true);
    try {
      const res = await fetch("/api/razorpay/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: gwKeyId.trim(), keySecret: gwSecret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save keys");
        return;
      }
      setGateway(data);
      setGwSecret("");
      toast.success("Razorpay connected", { description: "Online payments are now live." });
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setGwSaving(false);
    }
  }

  async function disconnectGateway() {
    try {
      const res = await fetch("/api/razorpay/config", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not disconnect");
        return;
      }
      setGateway(data);
      setGwKeyId("");
      setGwSecret("");
      toast.success("Razorpay disconnected");
    } catch {
      toast.error("Could not reach the server");
    }
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Payments"
        description="Collection, gateways and payment health at a glance."
        actions={
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            render={<Link href={routes.admin.commerce.transactions} />}
          >
            <Receipt className="size-4" />
            View transactions
          </Button>
        }
      />

      {/* Primary metrics */}
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <DashboardStatCard
          title="Today's collection"
          value={formatCurrency(mounted ? a.todayCollection : 0)}
          change={`${mounted ? a.collectedOrders : 0} orders collected`}
          icon={IndianRupee}
          tone="bakery"
        />
        <DashboardStatCard
          title="Total collection"
          value={formatCurrency(mounted ? a.totalCollection : 0)}
          change="all time"
          icon={TrendingUp}
          tone="gold"
        />
        <DashboardStatCard
          title="Success rate"
          value={`${mounted ? a.successRate : 0}%`}
          change={mounted ? `${a.failedCount} failed` : ""}
          changeTone={mounted && a.failedCount > 0 ? "warning" : "positive"}
          icon={TrendingUp}
          tone="bakery"
        />
        <DashboardStatCard
          title="Avg order value"
          value={formatCurrency(mounted ? a.aov : 0)}
          change={`top: ${mounted ? a.topMethodLabel : "—"}`}
          icon={Receipt}
          tone="neutral"
        />
      </section>

      {/* Secondary metrics */}
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <DashboardStatCard title="Online" value={formatCurrency(mounted ? a.onlineAmount : 0)} change="card / UPI / wallet" icon={CreditCard} tone="gold" />
        <DashboardStatCard title="Offline (COD)" value={formatCurrency(mounted ? a.offlineAmount : 0)} change="cash on delivery" icon={Banknote} tone="neutral" />
        <DashboardStatCard title="Pending" value={String(mounted ? a.pendingCount : 0)} change={formatCurrency(mounted ? a.pendingAmount : 0)} changeTone={mounted && a.pendingCount > 0 ? "warning" : "positive"} icon={Wallet} tone="gold" />
        <DashboardStatCard title="Refunds" value={String(mounted ? a.refundCount : 0)} change={`${mounted ? a.refundRate : 0}% · ${formatCurrency(mounted ? a.refundAmount : 0)}`} icon={RotateCcw} tone="neutral" />
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue — last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={a.revenueSeries} />
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment method breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentMethodBreakdown methods={a.methodBreakdown} />
          </CardContent>
        </Card>
      </section>

      {/* Quick links */}
      {/* Stack on mobile — three across at 390px clips the labels. */}
      <section className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-bakery-700/40"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cream-100 text-bakery-700">
                <link.icon className="size-4" />
              </span>
              <span className="truncate text-sm font-medium text-foreground">{link.label}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </section>

      {/* Razorpay connection */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Payment Gateway — Razorpay</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your Razorpay API keys to accept online payments (UPI, Cards, Netbanking, Wallets).
            </p>
          </div>
          {gateway ? (
            gateway.configured ? (
              <Badge variant="accent" className="shrink-0">
                Connected{gateway.testMode === true ? " · Test" : gateway.testMode === false ? " · Live" : ""}
              </Badge>
            ) : (
              <Badge className="shrink-0 bg-amber-100 text-amber-800">Not connected</Badge>
            )
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {gateway?.envLocked ? (
            <div className="rounded-xl border border-border bg-cream-50 p-4 text-sm text-muted-foreground">
              Keys are set via environment variables (<code>.env.local</code>). To change them, edit
              that file and restart the server.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gwKeyId">Key ID</Label>
              <Input
                id="gwKeyId"
                placeholder="rzp_test_xxxxxxxxxxxx"
                value={gwKeyId}
                onChange={(e) => setGwKeyId(e.target.value)}
                disabled={gateway?.envLocked}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gwSecret">Key Secret</Label>
              <Input
                id="gwSecret"
                type="password"
                placeholder={gateway?.configured ? "•••••••• (hidden — enter to replace)" : "Enter your secret key"}
                value={gwSecret}
                onChange={(e) => setGwSecret(e.target.value)}
                disabled={gateway?.envLocked}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="bakery" onClick={saveGateway} disabled={gwSaving || gateway?.envLocked}>
              {gwSaving ? "Saving…" : gateway?.configured ? "Update keys" : "Save & Connect"}
            </Button>
            {gateway?.configured && !gateway.envLocked ? (
              <Button variant="outline" onClick={disconnectGateway}>
                Disconnect
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            Get keys from{" "}
            <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer" className="font-medium text-bakery-700 hover:underline">
              dashboard.razorpay.com
            </a>{" "}
            → Settings → API Keys. Use <code>rzp_test_</code> keys for testing. Your secret is stored
            on the server and never shown again.
          </p>
        </CardContent>
      </Card>

      {/* Quick methods */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Quick methods</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {enabledCount} enabled · manage all{" "}
              <Link href={routes.admin.commerce.gateways} className="font-medium text-bakery-700 hover:underline">
                payment gateways
              </Link>
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" render={<Link href={routes.admin.commerce.gateways} />}>
              <Layers className="size-4" />
              All gateways
            </Button>
            <Button variant="bakery" className="w-full sm:w-auto" disabled={!isDirty} onClick={() => save("Payment methods saved")}>
              Save methods
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {methodOptions.map((method) => {
            const Icon = method.icon;
            const checked = settings.paymentMethods[method.key];
            const isLastEnabled = checked && enabledCount <= 1;
            return (
              <div key={method.key} className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted p-2 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="font-medium">{method.label}</p>
                    <p className="text-sm text-muted-foreground">{method.description}</p>
                  </div>
                </div>
                <Switch checked={checked} disabled={isLastEnabled} onCheckedChange={(next) => toggleMethod(method.key, next)} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
