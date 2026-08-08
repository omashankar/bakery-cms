"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import { useCommerceOverviews } from "@/apps/admin/commerce/lib/use-commerce-overviews";
import { getPaymentAnalytics } from "@/features/payments/lib/payment-analytics";
import {
  getOrders,
  ORDERS_UPDATED_EVENT,
  type PlacedOrder,
} from "@/features/orders/lib/orders";
import { RevenueChart } from "@/features/payments/components/revenue-chart";
import { PaymentMethodBreakdown } from "@/features/payments/components/payment-method-breakdown";
import { UnclaimedPaymentsAlert } from "@/apps/admin/commerce/components/unclaimed-payments-alert";
import { RazorpaySummaryCard } from "@/apps/admin/commerce/components/razorpay-summary-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { formatCurrency } from "@/utils/format";

const quickLinks = [
  { href: routes.admin.commerce.gateways, label: "Gateways", icon: Layers },
  { href: routes.admin.commerce.transactions, label: "Transactions", icon: Receipt },
  { href: routes.admin.commerce.refunds, label: "Refunds", icon: RotateCcw },
];

export function PaymentsAdminPage() {
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [mounted, setMounted] = useState(false);
  const { overviews } = useCommerceOverviews();

  useEffect(() => {
    setMounted(true);

    function refresh() {
      setOrders(getOrders());
    }

    refresh();
    window.addEventListener(ORDERS_UPDATED_EVENT, refresh);

    // The gateway status belongs to `RazorpaySummaryCard`, which fetches it
    // itself. Fetching it here too would be a second request for one answer.

    return () => {
      window.removeEventListener(ORDERS_UPDATED_EVENT, refresh);
    };
  }, []);

  // Collection totals span every order, which the local cache cannot answer —
  // it only holds the most recent slice. Until the server replies (and if it
  // never does: offline, expired session) fall back to what is loaded, so the
  // cards are never a row of zeros telling a working shop it collected nothing.
  // The offset matters even here: without it "Today's collection" is counted on
  // UTC days, so an IST admin loses everything placed before 05:30 and gains
  // yesterday evening's. Every other caller sends it; this path must too.
  const serverBacked = Boolean(overviews?.payments);
  const a =
    overviews?.payments ?? getPaymentAnalytics(orders, Intl.DateTimeFormat().resolvedOptions().timeZone);

  /**
   * Say when a figure is the fallback.
   *
   * `serverBacked` existed and was used on exactly ONE of the eight cards.
   * The other seven, and both charts, rendered figures computed over this
   * browser's order cache — which holds the most recent slice — under labels
   * that read as the whole shop, with nothing to say otherwise. A shop with
   * more orders than the cache read smaller numbers everywhere and had no way
   * to tell.
   */
  const note = (whenServer: string) =>
    serverBacked ? whenServer : "recent orders only — reconnecting";
  const noteTone = (whenServer?: "positive" | "warning") =>
    serverBacked ? whenServer : ("warning" as const);

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      {/* No header action: "View transactions" here duplicated the Transactions
          tile at the foot of the same page. */}
      <AdminPageHeader
        title="Payments"
        description="Collection, gateways and payment health at a glance."
      />

      {/* Money that arrived with no order behind it. Above the metrics on
          purpose — none of those cards can show it, because every one of them is
          computed from orders. */}
      <UnclaimedPaymentsAlert />

      {/* Status only. The keys FORM lives on the Razorpay gateway page — having
          it in both places meant the same three inputs twice, with nothing to
          say which one was authoritative. */}
      <RazorpaySummaryCard />

      {/*
        Eight stat cards used to sit here as two unlabelled rows split
        "primary"/"secondary" — a distinction that meant nothing to the reader,
        with Success rate beside Today's collection and Pending beside Online.
        Grouped by the question they answer instead: how much came in, and is
        anything wrong with it.
      */}
      <section className="space-y-2.5 sm:space-y-3">
        <h2 className="font-heading text-base font-bold text-foreground">Collection</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          <DashboardStatCard
            title="Today's collection"
            value={formatCurrency(mounted ? a.todayCollection : 0)}
            // TODAY's count. The subtitle read `collectedOrders`, which is the
            // all-time figure — so a card headed "Today's collection" printed a
            // lifetime order count underneath a one-day amount.
            change={note(`${mounted ? a.todayCount : 0} orders collected today`)}
            changeTone={noteTone()}
            icon={IndianRupee}
            tone="bakery"
          />
          <DashboardStatCard
            title="Total collection"
            value={formatCurrency(mounted ? a.totalCollection : 0)}
            // "all time" is only true of the SERVER's figure. The fallback runs
            // over this browser's order cache, which holds the most recent slice
            // — so a shop with more orders than that read a smaller number under
            // a label promising every one of them, with nothing to say so.
            change={note("all time")}
            changeTone={noteTone()}
            icon={TrendingUp}
            tone="gold"
          />
          <DashboardStatCard
            title="Online"
            value={formatCurrency(mounted ? a.onlineAmount : 0)}
            change={note("card / UPI / wallet")}
            changeTone={noteTone()}
            icon={CreditCard}
            tone="gold"
          />
          <DashboardStatCard
            title="Offline (COD)"
            value={formatCurrency(mounted ? a.offlineAmount : 0)}
            change={note("cash on delivery")}
            changeTone={noteTone()}
            icon={Banknote}
            tone="neutral"
          />
        </div>
      </section>

      <section className="space-y-2.5 sm:space-y-3">
        <h2 className="font-heading text-base font-bold text-foreground">Health</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          <DashboardStatCard
            title="Success rate"
            value={`${mounted ? a.successRate : 0}%`}
            change={note(mounted ? `${a.failedCount} failed` : "")}
            changeTone={noteTone(mounted && a.failedCount > 0 ? "warning" : "positive")}
            icon={TrendingUp}
            tone="bakery"
          />
          <DashboardStatCard
            title="Pending"
            value={String(mounted ? a.pendingCount : 0)}
            change={note(formatCurrency(mounted ? a.pendingAmount : 0))}
            changeTone={noteTone(mounted && a.pendingCount > 0 ? "warning" : "positive")}
            icon={Wallet}
            tone="gold"
          />
          <DashboardStatCard
            title="Refunds"
            value={String(mounted ? a.refundCount : 0)}
            change={note(`${mounted ? a.refundRate : 0}% · ${formatCurrency(mounted ? a.refundAmount : 0)}`)}
            changeTone={noteTone()}
            icon={RotateCcw}
            tone="neutral"
          />
          <DashboardStatCard
            title="Avg order value"
            value={formatCurrency(mounted ? a.aov : 0)}
            change={note(`top: ${mounted ? a.topMethodLabel : "—"}`)}
            changeTone={noteTone()}
            icon={Receipt}
            tone="neutral"
          />
        </div>
      </section>

      {/*
        Charts. Both are drawn from the same figures as the cards, so when those
        are the fallback these are too — and a chart says even less about where
        its data came from than a number does.
      */}
      {mounted && !serverBacked ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="status"
        >
          Showing this browser&apos;s most recent orders — the server did not answer.
          Totals and charts below are lower than the shop&apos;s real figures.
        </p>
      ) : null}

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

      {/*
        The three screens behind this one. "View transactions" also sat in the
        page header, so one destination had two entry points on a single screen
        while Gateways and Refunds had one each — the header action is gone and
        these three stand together.

        Stack on mobile — three across at 390px clips the labels.
      */}
      <section className="space-y-2.5 sm:space-y-3">
        <h2 className="font-heading text-base font-bold text-foreground">Go deeper</h2>
        <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
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
        </div>
      </section>
    </AdminPage>
  );
}
