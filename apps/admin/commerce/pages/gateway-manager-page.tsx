"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Landmark, Layers } from "lucide-react";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import {
  fetchGatewayCredentialStatus,
  getAllGatewayStates,
  GATEWAYS_UPDATED_EVENT,
  setGatewayEnabled,
  type ConnectionStatus,
  type GatewayCredentialStatus,
} from "@/features/payments/lib/payment-gateway-settings";
import { PAYMENT_GATEWAYS } from "@/features/payments/registry/gateways";
import { SETTINGS_UPDATED_EVENT } from "@/features/settings/lib/settings-repository";
import { GatewayCard } from "@/features/payments/components/gateway-card";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { FilterPanel, FilterPanelSearch } from "@/components/shared/filter-panel";
import { reportWrite } from "@/apps/admin/lib/report-write";

type Category = "all" | "online" | "offline";

export function GatewayManagerPage() {
  const [gateways, setGateways] = useState(() => getAllGatewayStates());
  const [mounted, setMounted] = useState(false);
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [razorpayStatus, setRazorpayStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    // Credential status comes from the SERVER now. It used to be derived from
    // whether this browser's localStorage held the required fields, so the same
    // gateway read "Configured" on the laptop it was set up on and "Not
    // configured" everywhere else.
    let statuses: Record<string, GatewayCredentialStatus | null> = {};
    const refresh = () => setGateways(getAllGatewayStates(statuses));
    refresh();
    setMounted(true);

    void Promise.all(
      PAYMENT_GATEWAYS.filter((g) => g.id !== "razorpay" && g.category !== "offline").map(
        async (g) => [g.id, await fetchGatewayCredentialStatus(g.id)] as const,
      ),
    ).then((entries) => {
      statuses = Object.fromEntries(entries);
      refresh();
    });

    // `verify=1`, like the two detail screens. Without it this list asked only
    // "are the variables non-empty" and printed a green Connected for keys
    // Razorpay rejects — so the same shop read Connected here and "Keys
    // rejected" one click away. `verified === false` is a real answer and must
    // not be rounded up to connected.
    fetch("/api/razorpay/config?verify=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((s: { configured?: boolean; verified?: boolean | null } | null) => {
        if (!s?.configured || s.verified === false) {
          setRazorpayStatus("not_configured");
          return;
        }
        setRazorpayStatus("connected");
      })
      .catch(() => setRazorpayStatus("not_configured"));

    window.addEventListener(GATEWAYS_UPDATED_EVENT, refresh);
    window.addEventListener(SETTINGS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(GATEWAYS_UPDATED_EVENT, refresh);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refresh);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gateways.filter(
      (g) =>
        (category === "all" || g.config.category === category) &&
        (!q || g.config.name.toLowerCase().includes(q))
    );
  }, [gateways, category, search]);

  // Split by what can actually charge someone. Ten of these twelve cannot: the
  // checkout renders exactly two methods, and only Razorpay has a server-side
  // payment path. Mixing them into one grid is what made a decorative card
  // indistinguishable from a working one.
  const wiredGateways = useMemo(() => filtered.filter((g) => g.config.isCore === true), [filtered]);
  const notYetGateways = useMemo(() => filtered.filter((g) => g.config.isCore !== true), [filtered]);

  // Counted over the gateways that can take money — the others cannot be
  // "active" in any sense a customer would notice.
  const chargeable = gateways.filter((g) => g.config.isCore === true);

  /**
   * "Live at checkout" has to mean what checkout does.
   *
   * These counted `runtime.enabled` alone — for Razorpay that is
   * `commerce.paymentMethods.razorpay`, which defaults to true. So a shop that
   * has never entered Razorpay keys read "Online 1 · live at checkout" while
   * the card two inches below showed the amber "Not configured" pill and the
   * storefront offered Cash on Delivery only: checkout drops Razorpay whenever
   * `/api/razorpay/availability` says it is not configured.
   *
   * The page had already asked and folded the answer into the CARD badge; it
   * just never reached the number whose subtitle is literally "live at
   * checkout". Held at zero until that answer arrives, rather than counting an
   * unanswered gateway as live.
   */
  const isLiveAtCheckout = (gateway: (typeof chargeable)[number]) => {
    if (!gateway.runtime.enabled) return false;
    if (gateway.config.id !== "razorpay") return true;
    return razorpayStatus === "connected";
  };

  const countsReady = mounted && razorpayStatus !== null;
  const enabledCount = countsReady ? chargeable.filter(isLiveAtCheckout).length : 0;
  const onlineCount = countsReady
    ? chargeable.filter((g) => g.config.category === "online" && isLiveAtCheckout(g)).length
    : 0;
  const offlineCount = countsReady
    ? chargeable.filter((g) => g.config.category === "offline" && isLiveAtCheckout(g)).length
    : 0;

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Payment Gateways"
        description="Enable and configure the gateways your bakery accepts."
      />

      <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {/*
          These counted the whole catalogue, so enabling Stripe raised "Online —
          live at checkout" to 2 when only one method could take a payment. They
          now count only the gateways that can.
        */}
        <DashboardStatCard
          title="Active gateways"
          value={String(enabledCount)}
          change={`of ${chargeable.length} available today`}
          icon={Layers}
          tone="bakery"
        />
        <DashboardStatCard
          title="Online"
          value={String(onlineCount)}
          change="live at checkout"
          icon={CreditCard}
          tone="gold"
        />
        <DashboardStatCard
          title="Offline"
          value={String(offlineCount)}
          change="cash on delivery"
          icon={Landmark}
          tone="neutral"
        />
      </section>

      <FilterPanel>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <FilterPanelSearch
            value={search}
            onChange={setSearch}
            placeholder="Search gateways…"
          />
          <AdminSelect
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            aria-label="Category"
            className="sm:w-44"
          >
            <option value="all">All categories</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </AdminSelect>
        </div>
      </FilterPanel>

      {wiredGateways.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="font-heading text-base font-bold text-foreground">Available now</h2>
            <p className="text-sm text-muted-foreground">
              These can take money and appear at checkout.
            </p>
          </div>
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {wiredGateways.map(({ config, runtime, status }) => (
              <GatewayCard
                key={config.id}
                config={config}
                runtime={runtime}
                status={config.id === "razorpay" && razorpayStatus ? razorpayStatus : status}
                onToggle={(enabled) => {
                  void setGatewayEnabled(config.id, enabled).then((persisted) =>
                    reportWrite(persisted, enabled ? "Gateway enabled" : "Gateway disabled")
                  );
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/*
        Kept, but no longer pretending. Every one of these had a live switch, a
        credentials form and a place in the "live at checkout" count — so an
        admin could enable Stripe, paste a real `sk_live_` secret, and have the
        screen agree that online payments were set up, while the checkout went on
        offering only Razorpay and cash.
      */}
      {notYetGateways.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="font-heading text-base font-bold text-foreground">Not available yet</h2>
            <p className="text-sm text-muted-foreground">
              In the catalogue, but not connected to a payment path — they cannot take money and do
              not appear at checkout. Nothing to configure until they are built.
            </p>
          </div>
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {notYetGateways.map(({ config, runtime, status }) => (
              <GatewayCard
                key={config.id}
                config={config}
                runtime={runtime}
                status={status}
                onToggle={() => undefined}
              />
            ))}
          </div>
        </section>
      ) : null}
    </AdminPage>
  );
}
