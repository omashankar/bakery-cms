"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Landmark, Layers } from "lucide-react";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import {
  getAllGatewayStates,
  GATEWAYS_UPDATED_EVENT,
  setGatewayEnabled,
  setGatewayMode,
  type ConnectionStatus,
  type GatewayMode,
} from "@/features/payments/lib/payment-gateway-settings";
import { SETTINGS_UPDATED_EVENT } from "@/features/settings/lib/settings-repository";
import { GatewayCard } from "@/features/payments/components/gateway-card";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { FilterPanel, FilterPanelSearch } from "@/components/shared/filter-panel";

type Category = "all" | "online" | "offline";

export function GatewayManagerPage() {
  const [gateways, setGateways] = useState(() => getAllGatewayStates());
  const [mounted, setMounted] = useState(false);
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [razorpayStatus, setRazorpayStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    const refresh = () => setGateways(getAllGatewayStates());
    refresh();
    setMounted(true);

    fetch("/api/razorpay/config")
      .then((res) => res.json())
      .then((s: { configured: boolean }) =>
        setRazorpayStatus(s.configured ? "connected" : "not_configured")
      )
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

  const enabledCount = mounted ? gateways.filter((g) => g.runtime.enabled).length : 0;
  const onlineCount = mounted
    ? gateways.filter((g) => g.config.category === "online" && g.runtime.enabled).length
    : 0;
  const offlineCount = mounted
    ? gateways.filter((g) => g.config.category === "offline" && g.runtime.enabled).length
    : 0;

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Payment Gateways"
        description="Enable, configure and prioritise the gateways your bakery accepts."
      />

      <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <DashboardStatCard
          title="Active gateways"
          value={String(enabledCount)}
          change={`of ${gateways.length} available`}
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
          change="COD / pickup / transfer"
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

      <section className="grid gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filtered.map(({ config, runtime, status }) => (
          <GatewayCard
            key={config.id}
            config={config}
            runtime={runtime}
            status={config.id === "razorpay" && razorpayStatus ? razorpayStatus : status}
            onToggle={(enabled) => setGatewayEnabled(config.id, enabled)}
            onModeChange={(mode: GatewayMode) => setGatewayMode(config.id, mode)}
          />
        ))}
      </section>
    </AdminPage>
  );
}
