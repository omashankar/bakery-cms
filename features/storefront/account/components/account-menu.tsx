"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, MapPin, Package, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routes } from "@/constants/routes";
import { clearCustomerSession } from "@/features/storefront/account/lib/customer-session";
import { useHoverMenu } from "@/features/storefront/account/hooks/use-hover-menu";

interface AccountMenuProps {
  name: string;
  phone?: string;
  onSignOut?: () => void;
}

export function getAccountInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const menuLinks = [
  { href: routes.account.dashboard, label: "My Profile", icon: User },
  { href: routes.account.orders, label: "Orders", icon: Package },
  { href: routes.account.addresses, label: "Addresses", icon: MapPin },
] as const;

export function AccountMenu({ name, phone, onSignOut }: AccountMenuProps) {
  const router = useRouter();
  const { open, setOpen, hoverProps } = useHoverMenu();

  function handleLogout() {
    clearCustomerSession();
    onSignOut?.();
    router.push(routes.store.home);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        aria-label={`${name}'s account`}
        {...hoverProps}
        className="flex size-9 items-center justify-center rounded-full bg-bakery-700 text-xs font-bold text-white shadow-sm outline-none transition-premium hover:bg-bakery-800 focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 data-[popup-open]:bg-bakery-800"
      >
        {getAccountInitials(name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        {...hoverProps}
        className="w-60 rounded-2xl p-1.5 ring-border"
      >
        <div className="flex items-center gap-3 rounded-xl bg-cream-100 px-3 py-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bakery-700 text-xs font-bold text-white">
            {getAccountInitials(name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            {phone ? (
              <p className="truncate text-xs text-muted-foreground">{phone}</p>
            ) : null}
          </div>
        </div>

        <div className="my-1.5 h-px bg-border" />

        {menuLinks.map((item) => (
          <DropdownMenuItem
            key={item.href}
            render={<Link href={item.href} />}
            className="gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground focus:bg-cream-100 focus:text-bakery-700"
          >
            <item.icon className="size-4 text-muted-foreground" />
            {item.label}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={handleLogout}
          className="gap-2.5 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
