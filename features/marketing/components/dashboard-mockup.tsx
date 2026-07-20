import {
  ArrowUpRightIcon,
  BarChart3Icon,
  BellIcon,
  BoxesIcon,
  CakeIcon,
  CroissantIcon,
  LayoutDashboardIcon,
  SearchIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { icon: LayoutDashboardIcon, label: "Dashboard", active: true },
  { icon: ShoppingBagIcon, label: "Orders" },
  { icon: CakeIcon, label: "Products" },
  { icon: UsersIcon, label: "Customers" },
  { icon: BoxesIcon, label: "Inventory" },
  { icon: TruckIcon, label: "Delivery" },
  { icon: BarChart3Icon, label: "Reports" },
  { icon: SettingsIcon, label: "Settings" },
];

const stats = [
  { label: "Revenue", value: "₹4.82L", delta: "+12.4%" },
  { label: "Orders", value: "1,284", delta: "+8.1%" },
  { label: "Customers", value: "3,912", delta: "+5.6%" },
  { label: "Conversion", value: "4.8%", delta: "+1.2%" },
];

// Bar heights in px (definite values render reliably in any flex context).
const bars = [42, 58, 46, 72, 63, 88, 70, 96, 82, 108, 94, 120];

const recent = [
  { name: "Truffle Cake", amount: "₹2,450", tone: "bg-[#BFD8B4] text-[#3f6b39]", status: "Paid" },
  { name: "Wedding Tier", amount: "₹18,900", tone: "bg-[#EBD4A0] text-[#7a5a1e]", status: "Baking" },
  { name: "Cheesecake", amount: "₹1,180", tone: "bg-[#BFD8B4] text-[#3f6b39]", status: "Paid" },
  { name: "Birthday Cake", amount: "₹3,320", tone: "bg-[#CBD9EA] text-[#3d5578]", status: "Shipped" },
];

/** Faux Bakery CMS admin dashboard — the hero illustration. Pure CSS. */
export function DashboardMockup({ className }: { className?: string }) {
  return (
    <div className={cn("@container flex min-h-[420px] w-full bg-[#FCFBF9] text-foreground", className)}>
      {/* Sidebar */}
      <aside className="hidden w-[168px] shrink-0 flex-col border-r border-border bg-[#FBFAF8] p-3 @md:flex">
        <div className="flex items-center gap-2 px-1.5 py-1">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CroissantIcon className="size-4" />
          </span>
          <span className="font-heading text-[13px] font-bold">Bakery CMS</span>
        </div>
        <nav className="mt-4 flex flex-col gap-0.5">
          {nav.map((item) => (
            <span
              key={item.label}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium",
                item.active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </span>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        {/* Topbar */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-heading text-[15px] font-semibold">Dashboard</p>
            <p className="text-[11px] text-muted-foreground">Welcome back, Aarav — here&apos;s today.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground @sm:flex">
              <SearchIcon className="size-3" /> Search
            </span>
            <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
              <BellIcon className="size-3.5" />
            </span>
            <span className="flex size-8 items-center justify-center rounded-full bg-[#D4A373] text-[11px] font-bold text-[#3a2413]">
              AK
            </span>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 @lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0 rounded-xl border border-border bg-card p-3">
              <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 truncate font-heading text-[17px] font-semibold leading-none">{s.value}</p>
              <span className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#4f8a45]">
                <ArrowUpRightIcon className="size-2.5" />
                {s.delta}
              </span>
            </div>
          ))}
        </div>

        {/* Chart + list */}
        <div className="mt-3 grid flex-1 grid-cols-1 gap-3 @lg:grid-cols-3">
          {/* Chart */}
          <div className="flex flex-col rounded-xl border border-border bg-card p-3.5 @lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold">Revenue overview</p>
              <span className="rounded-md bg-[#F3EEE7] px-2 py-0.5 text-[10px] font-medium text-[#8a6a45]">
                Last 12 months
              </span>
            </div>
            <div className="mt-4 flex flex-1 items-end gap-1.5">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-t-[3px]",
                    i === bars.length - 1 ? "bg-[#D4A373]" : "bg-[#7A4D2B]/30"
                  )}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-muted-foreground">
              <span>Jan</span>
              <span>Apr</span>
              <span>Jul</span>
              <span>Oct</span>
              <span>Dec</span>
            </div>
          </div>

          {/* Recent orders */}
          <div className="rounded-xl border border-border bg-card p-3.5">
            <p className="text-[12px] font-semibold">Recent orders</p>
            <div className="mt-3 flex flex-col gap-2.5">
              {recent.map((o) => (
                <div key={o.name} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium">{o.name}</p>
                    <p className="text-[10px] text-muted-foreground">{o.amount}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold", o.tone)}>
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
