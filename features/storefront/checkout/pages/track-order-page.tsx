"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { MapPin, PackageSearch, Truck } from "lucide-react";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { getOrderByNumber, getOrders } from "@/features/orders/lib/orders";
import { verifyOrderLookup } from "@/features/orders/lib/order-tracking";
import { grantOrderAccess } from "@/features/orders/lib/order-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { toast } from "sonner";

type TrackOrderForm = {
  orderNumber: string;
  email: string;
};

export function TrackOrderPage() {
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<TrackOrderForm>();
  const [demoHint, setDemoHint] = useState<string | null>(null);

  useEffect(() => {
    const sample = getOrders()[0];
    if (sample) {
      setDemoHint(`${sample.orderNumber} · ${sample.address.email}`);
    }
  }, []);

  const onSubmit = (data: TrackOrderForm) => {
    const order = getOrderByNumber(data.orderNumber.trim().toUpperCase());
    if (!order) {
      toast.error("Order not found", {
        description: "Check the order number and try again.",
      });
      return;
    }

    if (!verifyOrderLookup(order, { email: data.email })) {
      toast.error("Details do not match", {
        description: "Use the email from your order confirmation.",
      });
      return;
    }

    // Ownership proven — let the detail page render for this browser session.
    grantOrderAccess(order.orderNumber);
    router.push(routes.store.orderDetail(order.orderNumber));
  };

  return (
    <>
      <StorePageHeader
        title="Track Your Order"
        description="Enter your order number and email to see live delivery status, ETA, and route preview."
        breadcrumbs={[{ label: "Track Order" }]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center gap-2">
                <PackageSearch className="size-5 text-bakery-700" />
                <h2 className="font-heading text-lg font-semibold">Find your order</h2>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <Label htmlFor="orderNumber">Order number</Label>
                  <Input
                    id="orderNumber"
                    placeholder="BK-20260708-1234"
                    className="uppercase"
                    {...register("orderNumber", { required: "Order number is required" })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email used at checkout</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    {...register("email", { required: "Email is required" })}
                  />
                </div>
                <Button
                  type="submit"
                  variant="bakery"
                  className="w-full"
                  disabled={formState.isSubmitting}
                >
                  Track order
                </Button>
              </form>

              {demoHint ? (
                <p className="mt-4 rounded-lg border border-dashed border-border bg-cream-50 px-3 py-2 text-xs text-muted-foreground">
                  Demo order: <span className="font-medium text-foreground">{demoHint}</span>
                </p>
              ) : null}

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Just placed an order?{" "}
                <Link href={routes.store.orderSuccess} className="text-bakery-700 hover:underline">
                  View confirmation
                </Link>
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-cream-50 p-5">
                <div className="flex items-center gap-2 text-bakery-700">
                  <Truck className="size-4" />
                  <p className="text-sm font-medium">What you can track</p>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>• Estimated delivery date and time window</li>
                  <li>• Step-by-step bakery fulfillment timeline</li>
                  <li>• Delivery partner details when dispatched</li>
                  <li>• Route map preview while out for delivery</li>
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-bakery-700">
                  <MapPin className="size-4" />
                  <p className="text-sm font-medium">Need help?</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Contact our store team if your delivery is delayed or you need to update the
                  address before dispatch.
                </p>
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  render={<Link href={routes.store.contact} />}
                >
                  Contact support
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
