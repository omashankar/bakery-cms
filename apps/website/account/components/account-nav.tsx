"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, MapPin, Package, User } from "lucide-react";
import {
  getCustomerDisplayName,
  getCustomerSession,
  signOutCustomer,
} from "@/apps/website/account/lib/customer-session";
import { EditableAvatar } from "@/apps/website/account/components/account-avatar";
import { displayNameOf, useAccountProfile } from "@/apps/website/account/components/account-context";
import { useAvatarEditor } from "@/apps/website/account/hooks/use-avatar-editor";
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
  const profile = useAccountProfile();
  // The server's answer first, so the avatar and name are in the first paint;
  // the browser session updates them after an edit.
  const [mounted, setMounted] = useState(Boolean(profile));
  const [name, setName] = useState(profile ? displayNameOf(profile) : "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? "");
  const avatar = useAvatarEditor();

  useEffect(() => {
    const load = () => {
      // Only when the browser has one: before it does, the server's stands.
      const session = getCustomerSession();
      if (!session) return;
      setName(getCustomerDisplayName());
      setPhone(session.phone ?? "");
      // A copy cached before photos existed has no field at all; "" is a removal.
      if (session.avatarUrl !== undefined) setAvatarUrl(session.avatarUrl);
    };
    load();
    setMounted(true);
    window.addEventListener("bakery-customer-session-updated", load);
    return () => window.removeEventListener("bakery-customer-session-updated", load);
  }, []);

  async function handleLogout() {
    // Same path as the header menu: the server ends the session, and this
    // device is cleared whether or not it could be reached.
    await signOutCustomer();
    onNavigate?.();
    router.push(routes.store.home);
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Profile header */}
      <div className="flex flex-col items-center bg-gradient-to-br from-bakery-700 to-bakery-900 px-5 pt-6 pb-5 text-center text-white">
        {/*
          The photo IS the button: pressing it opens the file picker, and the
          camera badge says so. Removing it is on the profile page, beside
          Change, where a slip of the thumb is less likely.
        */}
        <EditableAvatar
          name={name}
          avatarUrl={avatarUrl}
          busy={avatar.busy}
          onChoose={avatar.choose}
          ready={mounted}
          className="size-20 bg-white/15 text-xl ring-4 ring-white/20"
        />
        <input {...avatar.inputProps} />
        <p className="mt-3 w-full truncate font-heading text-base font-bold">
          {mounted ? name : ""}
        </p>
        {mounted && phone ? (
          <p className="w-full truncate text-sm text-white/70">{phone}</p>
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
          onClick={() => void handleLogout()}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </nav>
    </div>
  );
}
