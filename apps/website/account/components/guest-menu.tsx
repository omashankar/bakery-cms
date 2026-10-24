"use client";

import Link from "next/link";
import { Heart, LifeBuoy, Package, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { openCustomerAuthModal } from "@/apps/website/account/lib/auth-modal-events";
import { useHoverMenu } from "@/apps/website/account/hooks/use-hover-menu";
import { ACCOUNT_TRIGGER_CLASS, AccountTriggerFace } from "./account-trigger";

interface GuestLink {
  label: string;
  icon: typeof User;
  href?: string;
  requiresAuth?: boolean;
}

const guestLinks: GuestLink[] = [
  { label: "My Profile", icon: User, requiresAuth: true },
  { label: "Orders", icon: Package, requiresAuth: true },
  { label: "Wishlist", icon: Heart, href: routes.store.wishlist },
  { label: "Help & Support", icon: LifeBuoy, href: routes.store.contact },
];

/** `initialOpen`: mounted by the lazy loader on the hover that asked for it. */
export function GuestMenu({ initialOpen = false }: { initialOpen?: boolean } = {}) {
  const { open, setOpen, hoverProps } = useHoverMenu(150, initialOpen);

  const login = () => {
    setOpen(false);
    openCustomerAuthModal("phone");
  };
  const signup = () => {
    setOpen(false);
    openCustomerAuthModal("signup");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        aria-label="Login"
        {...hoverProps}
        /*
          The same round mark a signed-in customer's initials sit in, with
          "Login" beside it from lg — see AccountTriggerFace. Its name stays
          "Login" (the aria-label above), which is what a screen reader says
          and what the tests press.
        */
        className={ACCOUNT_TRIGGER_CLASS}
      >
        <AccountTriggerFace name={null} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        {...hoverProps}
        className="w-64 overflow-hidden rounded-2xl p-0 ring-border"
      >
        {/* Login / Sign up header */}
        <div className="border-b border-border p-3">
          <Button variant="bakery" className="w-full" onClick={login}>
            Login
          </Button>
          <p className="mt-2.5 text-center text-sm text-muted-foreground">
            New customer?{" "}
            <button
              type="button"
              onClick={signup}
              className="font-semibold text-bakery-700 hover:underline"
            >
              Sign Up
            </button>
          </p>
        </div>

        {/* Menu */}
        <div className="p-1.5">
          {guestLinks.map((item) =>
            item.requiresAuth ? (
              <DropdownMenuItem
                key={item.label}
                onClick={login}
                className="gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground focus:bg-transparent focus:text-bakery-700"
              >
                <item.icon className="size-4 text-muted-foreground" />
                {item.label}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                key={item.label}
                render={<Link href={item.href!} />}
                className="gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground focus:bg-transparent focus:text-bakery-700"
              >
                <item.icon className="size-4 text-muted-foreground" />
                {item.label}
              </DropdownMenuItem>
            )
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
