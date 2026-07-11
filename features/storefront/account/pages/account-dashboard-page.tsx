"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Package, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { AccountOrderStatusBadge } from "@/features/storefront/account/components/account-order-status-badge";
import { AccountShell } from "@/features/storefront/account/components/account-shell";
import { useCustomerAuth } from "@/features/storefront/account/hooks/use-customer-auth";
import { getSavedAddresses } from "@/features/storefront/account/lib/customer-addresses";
import { getOrdersForCustomer } from "@/features/storefront/checkout/lib/orders";
import { ProductRailSection } from "@/features/storefront/components/product-rail-section";
import { getRecommendedCakes } from "@/features/storefront/lib/recommended-cakes";
import { getRecentlyViewedCakes } from "@/features/storefront/lib/recently-viewed";
import { reorderFromOrder } from "@/features/storefront/lib/reorder";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { formatCurrency, formatDate } from "@/utils/format";

export function AccountDashboardPage() {
  const router = useRouter();
  const { session, ready } = useCustomerAuth();
  const [addressCount, setAddressCount] = useState(0);

  const orders = useMemo(
    () => (session ? getOrdersForCustomer(session.email) : []),
    [session]
  );

  const recentOrders = orders.slice(0, 3);
  const activeOrders = orders.filter((order) => order.status !== "delivered").length;
  const recentlyViewed = useMemo(() => getRecentlyViewedCakes().slice(0, 4), []);
  const recommended = useMemo(() => getRecommendedCakes({ limit: 4 }), []);

  useEffect(() => {
    const refresh = () => setAddressCount(getSavedAddresses().length);
    refresh();
    window.addEventListener("bakery-addresses-updated", refresh);
    return () => window.removeEventListener("bakery-addresses-updated", refresh);
  }, []);

  function handleReorder(orderNumber: string) {
    const order = orders.find((entry) => entry.orderNumber === orderNumber);
    if (!order) return;
    const result = reorderFromOrder(order);
    if (result.added === 0) {
      toast.error("Could not reorder — items may be unavailable");
      return;
    }
    toast.success(`Added ${result.added} item${result.added === 1 ? "" : "s"} to cart`);
    router.push(routes.store.cart);
  }

  if (!ready || !session) {
    return null;
  }

  return (
    <AccountShell
      title={`Hello, ${session.name}`}
      description="Your account overview, recent orders, and quick links."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Package, label: "Total orders", value: String(orders.length) },
          { icon: ShoppingBag, label: "Active orders", value: String(activeOrders) },
          { icon: MapPin, label: "Saved addresses", value: String(addressCount) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-white p-5 shadow-sm"
          >
            <stat.icon className="size-5 text-bakery-700" />
            <p className="mt-3 text-2xl font-semibold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Recent orders</h2>
          <Button variant="outline" size="sm" render={<Link href={routes.account.orders} />}>
            View all orders
          </Button>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="Browse our cakes and place your first order."
            action={
              <Button variant="bakery" render={<Link href={routes.store.collections} />}>
                Shop cakes
              </Button>
            }
            className="mt-6"
          />
        ) : (
          <div className="mt-4 space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{order.orderNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(order.placedAt)} · {order.totals.itemCount} items
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <AccountOrderStatusBadge status={order.status} />
                  <span className="font-semibold">{formatCurrency(order.totals.total)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={routes.store.orderDetail(order.orderNumber)} />}
                  >
                    Track
                  </Button>
                  <Button
                    variant="bakery"
                    size="sm"
                    onClick={() => handleReorder(order.orderNumber)}
                  >
                    Reorder
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {recentlyViewed.length > 0 ? (
        <ProductRailSection
          title="Recently viewed"
          description="Cakes you looked at recently."
          cakes={recentlyViewed}
        />
      ) : null}

      {recommended.length > 0 ? (
        <ProductRailSection
          title="Recommended for you"
          description="Popular picks based on your activity."
          cakes={recommended}
        />
      ) : null}

      <div className="rounded-xl border border-border bg-cream-50 p-6">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="mt-1 font-medium">{session.email}</p>
        {session.phone ? (
          <p className="text-sm text-muted-foreground">{session.phone}</p>
        ) : null}
      </div>
    </AccountShell>
  );
}
