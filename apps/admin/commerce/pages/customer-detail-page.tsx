"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone, Plus, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { AdminOrderStatusBadge } from "@/apps/admin/commerce/components/admin-order-status-badge";
import { CustomerSegmentBadge } from "@/apps/admin/commerce/components/customer-segment-badge";
import {
  addCustomerTag,
  CUSTOMERS_UPDATED_EVENT,
  removeCustomerTag,
  updateCustomerMarketingOptIn,
  updateCustomerNotes,
} from "@/apps/admin/commerce/lib/customers-repository";
import {
  getCustomerActivity,
  getCustomerAddresses,
  getCustomerProfileById,
  type CustomerProfile,
} from "@/apps/admin/commerce/lib/customer-profile-utils";
import { ensureDemoOrders } from "@/apps/admin/commerce/lib/order-utils";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { getOrdersForCustomerRecord } from "@/apps/admin/commerce/lib/customer-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { routes } from "@/constants/routes";
import { formatCurrency, formatDate, formatRelativeTime } from "@/utils/format";

interface CustomerDetailPageProps {
  customerId: string;
}

export function CustomerDetailPage({ customerId }: CustomerDetailPageProps) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function refresh() {
      ensureDemoOrders();
      const nextProfile = getCustomerProfileById(customerId);
      setProfile(nextProfile);
      if (nextProfile) {
        setOrders(
          getOrdersForCustomerRecord(nextProfile.email).sort(
            (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
          )
        );
        setNotes(nextProfile.meta.notes);
      }
    }

    refresh();
    window.addEventListener("bakery-orders-updated", refresh);
    window.addEventListener(CUSTOMERS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("bakery-orders-updated", refresh);
      window.removeEventListener(CUSTOMERS_UPDATED_EVENT, refresh);
    };
  }, [customerId, refreshKey]);

  const addresses = useMemo(
    () => (profile ? getCustomerAddresses(profile.email) : []),
    [profile, refreshKey]
  );
  const activity = useMemo(
    () => (profile ? getCustomerActivity(profile.email) : []),
    [profile, refreshKey]
  );

  if (!profile) {
    return (
      <AdminPage>
        <AdminPageHeader
          title="Customer not found"
          description="This customer record could not be loaded."
          actions={
            <Button variant="outline" render={<Link href={routes.admin.customers.list} />}>
              <ArrowLeft className="size-4" />
              Back to customers
            </Button>
          }
        />
      </AdminPage>
    );
  }

  function refreshProfile() {
    setRefreshKey((value) => value + 1);
  }

  function handleSaveNotes() {
    if (!profile) return;
    updateCustomerNotes(profile.email, notes);
    refreshProfile();
    toast.success("Customer notes saved");
  }

  function handleMarketingToggle(checked: boolean) {
    if (!profile) return;
    updateCustomerMarketingOptIn(profile.email, checked);
    refreshProfile();
    toast.success(checked ? "Marketing opt-in enabled" : "Marketing opt-in disabled");
  }

  function handleAddTag() {
    if (!profile) return;
    const saved = addCustomerTag(profile.email, tagInput);
    setTagInput("");
    setProfile((current) => (current ? { ...current, meta: saved } : current));
    toast.success("Tag added");
  }

  function handleRemoveTag(tag: string) {
    if (!profile) return;
    const saved = removeCustomerTag(profile.email, tag);
    setProfile((current) => (current ? { ...current, meta: saved } : current));
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title={profile.name}
        description={`${profile.orderCount} order${profile.orderCount === 1 ? "" : "s"} · ${formatCurrency(profile.totalSpent)} lifetime`}
        actions={
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="min-w-0 flex-1 sm:flex-none"
              render={<Link href={routes.admin.orders.detail(orders[0]!.id)} />}
              disabled={orders.length === 0}
            >
              Latest order
            </Button>
            <Button
              variant="outline"
              className="min-w-0 flex-1 sm:flex-none"
              render={<Link href={routes.admin.customers.list} />}
            >
              <ArrowLeft className="size-4" />
              All customers
            </Button>
          </div>
        }
      />

      <section className="flex flex-wrap items-center gap-2">
        <CustomerSegmentBadge segment={profile.segment} />
        {profile.meta.marketingOptIn ? (
          <Badge variant="secondary">Marketing opt-in</Badge>
        ) : (
          <Badge variant="outline">Marketing opted out</Badge>
        )}
        {profile.meta.tags.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Lifetime value", value: formatCurrency(profile.totalSpent) },
          { label: "Orders", value: String(profile.orderCount) },
          { label: "Average order value", value: formatCurrency(profile.averageOrderValue) },
          { label: "Active orders", value: String(profile.activeOrders) },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Order history</CardTitle>
              <CardDescription>
                {profile.orderCount} order{profile.orderCount === 1 ? "" : "s"} from this customer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-border p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{order.orderNumber}</p>
                          <AdminOrderStatusBadge status={order.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(order.placedAt)} · {order.items.length} items ·{" "}
                          {order.paymentMethod.toUpperCase()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold">{formatCurrency(order.totals.total)}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link href={routes.admin.orders.detail(order.id)} />}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Delivery addresses</CardTitle>
              <CardDescription>Addresses used on past orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved delivery addresses yet.</p>
              ) : (
                addresses.map((address) => (
                  <div key={address.id} className="rounded-xl border border-border p-4 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">{address.fullName}</p>
                        <p className="text-muted-foreground">
                          {address.city}, {address.state} {address.pincode}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Used {address.usedCount} time{address.usedCount === 1 ? "" : "s"} · Last{" "}
                          {formatRelativeTime(address.lastUsedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Recent customer and order events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="flex gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0 flex-1">
                      {item.href ? (
                        <Link href={item.href} className="font-medium hover:text-primary">
                          {item.title}
                        </Link>
                      ) : (
                        <p className="font-medium">{item.title}</p>
                      )}
                      {item.description ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatRelativeTime(item.at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-4" />
                {profile.email}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4" />
                {profile.phone}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Commerce insights</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">First order</dt>
                  <dd className="text-right">{formatDate(profile.firstOrderAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Last order</dt>
                  <dd className="text-right">{formatDate(profile.lastOrderAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Preferred payment</dt>
                  <dd className="text-right">{profile.preferredPaymentMethod}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Delivered</dt>
                  <dd>{profile.deliveredOrders}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Cancelled / refunded</dt>
                  <dd>
                    {profile.cancelledOrders} / {profile.refundedOrders}
                  </dd>
                </div>
                {profile.cities.length > 0 ? (
                  <div className="pt-2">
                    <dt className="text-muted-foreground">Cities</dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {profile.cities.map((city) => (
                        <Badge key={city} variant="outline">
                          {city}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Favorite products</CardTitle>
              <CardDescription>Most ordered cakes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.favoriteProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No product history yet.</p>
              ) : (
                profile.favoriteProducts.map((product) => (
                  <div key={product.slug} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.quantity} ordered · {formatCurrency(product.revenue)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={routes.store.cake(product.slug)} />}
                    >
                      View
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Admin notes</CardTitle>
              <CardDescription>Internal notes for your team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer-notes">Notes</Label>
                <textarea
                  id="customer-notes"
                  className={adminTextareaClassName}
                  rows={5}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="VIP wedding client, prefers eggless cakes, always requests morning delivery…"
                />
              </div>
              <Button variant="bakery" className="w-full" onClick={handleSaveNotes}>
                Save notes
              </Button>

              <div className="space-y-2">
                <Label htmlFor="customer-tag">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    id="customer-tag"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    placeholder="Wedding, Corporate…"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.meta.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      <Tag className="size-3" />
                      {tag}
                      <X className="size-3" />
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-medium">Marketing opt-in</p>
                  <p className="text-xs text-muted-foreground">
                    Customer agrees to promotional email and offers
                  </p>
                </div>
                <Switch
                  checked={profile.meta.marketingOptIn}
                  onCheckedChange={handleMarketingToggle}
                />
              </label>
            </CardContent>
          </Card>
        </aside>
      </div>
    </AdminPage>
  );
}
