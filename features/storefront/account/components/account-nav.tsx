"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, MapPin, Package, User } from "lucide-react";
import {
  clearCustomerSession,
  getCustomerDisplayName,
  getCustomerSession,
} from "@/features/storefront/account/lib/customer-session";
import { getAccountInitials } from "@/features/storefront/account/components/account-menu";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

const navItems = [
  { href: routes.account.dashboard, label: "My Profile", icon: User },
  { href: routes.account.orders, label: "Orders", icon: Package },
  { href: routes.account.addresses, label: "Addresses", icon: MapPin },
] as const;

interface AccountNavProps {
  className?: string;
  onNavigate?: () => void;
}

export function AccountNav({ className, onNavigate }: AccountNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const load = () => {
      setName(getCustomerDisplayName());
      setPhone(getCustomerSession()?.phone ?? "");
    };
    load();
    setMounted(true);
    window.addEventListener("bakery-customer-session-updated", load);
    return () => window.removeEventListener("bakery-customer-session-updated", load);
  }, []);

  function handleLogout() {
    clearCustomerSession();
    onNavigate?.();
    router.push(routes.store.home);
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Profile header */}
      <div className="bg-bakery-700 px-5 py-5 text-white">
        <div className="flex size-14 items-center justify-center rounded-full bg-white/15 text-lg font-bold">
          {mounted ? getAccountInitials(name) : ""}
        </div>
        <p className="mt-3 truncate font-heading text-base font-bold">
          {mounted ? name : ""}
        </p>
        {mounted && phone ? (
          <p className="truncate text-sm text-white/70">{phone}</p>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== routes.account.dashboard && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-cream-100 text-bakery-700"
                  : "text-muted-foreground hover:bg-cream-100 hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        <div className="my-2 h-px bg-border" />

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </nav>
    </div>
  );
}
