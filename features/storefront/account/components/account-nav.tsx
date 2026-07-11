"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, LayoutDashboard, LogOut, MapPin, Package, User } from "lucide-react";
import { clearCustomerSession } from "@/features/storefront/account/lib/customer-session";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

const navItems = [
  { href: routes.account.dashboard, label: "Overview", icon: LayoutDashboard },
  { href: routes.account.orders, label: "Orders", icon: Package },
  { href: routes.account.addresses, label: "Addresses", icon: MapPin },
  { href: routes.account.profile, label: "Profile", icon: User },
  { href: routes.store.wishlist, label: "Wishlist", icon: Heart },
] as const;

interface AccountNavProps {
  className?: string;
  onNavigate?: () => void;
}

export function AccountNav({ className, onNavigate }: AccountNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearCustomerSession();
    router.push(routes.account.login);
  }

  return (
    <nav className={cn("space-y-1", className)}>
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
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
      <Button
        variant="ghost"
        className="mt-2 w-full justify-start text-muted-foreground"
        onClick={handleLogout}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
    </nav>
  );
}
