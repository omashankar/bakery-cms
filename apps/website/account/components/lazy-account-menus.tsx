"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChevronDown, User } from "lucide-react";
import { getAccountInitials } from "@/apps/website/account/lib/account-initials";

/**
 * The navbar's account menus, loaded when someone reaches for them.
 *
 * Both are dropdowns built on the menu, popover and focus-trap primitives —
 * the largest single piece of JavaScript on every storefront page after React
 * itself, measured by source map on /store — for a menu most visitors never
 * open, and which is hidden below `md` anyway. Until the pointer, focus or a
 * tap arrives, a button that looks exactly like the trigger stands in; the
 * real menu then loads and mounts already open, so the hover that asked for it
 * is the hover that opens it.
 */

const GuestMenu = dynamic(
  () => import("./guest-menu").then((m) => m.GuestMenu),
  { ssr: false, loading: () => <GuestTrigger /> },
);

const AccountMenu = dynamic(
  () => import("./account-menu").then((m) => m.AccountMenu),
  { ssr: false, loading: () => <AccountTrigger name="" /> },
);

const GUEST_TRIGGER =
  "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground outline-none transition-premium hover:bg-cream-100 hover:text-bakery-700 focus-visible:ring-2 focus-visible:ring-gold";

const ACCOUNT_TRIGGER =
  "flex size-9 items-center justify-center rounded-full bg-bakery-700 text-xs font-bold text-white shadow-sm outline-none transition-premium hover:bg-bakery-800 focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2";

function GuestTrigger({ onIntent }: { onIntent?: () => void }) {
  return (
    <button
      type="button"
      aria-label="Login"
      aria-haspopup="menu"
      className={GUEST_TRIGGER}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      onClick={onIntent}
    >
      <User className="size-[18px]" />
      Login
      <ChevronDown className="size-3.5" />
    </button>
  );
}

function AccountTrigger({ name, onIntent }: { name: string; onIntent?: () => void }) {
  return (
    <button
      type="button"
      aria-label={name ? `${name}'s account` : "Your account"}
      aria-haspopup="menu"
      className={ACCOUNT_TRIGGER}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      onClick={onIntent}
    >
      {name ? getAccountInitials(name) : null}
    </button>
  );
}

export function LazyGuestMenu() {
  const [wanted, setWanted] = useState(false);
  if (!wanted) return <GuestTrigger onIntent={() => setWanted(true)} />;
  return <GuestMenu initialOpen />;
}

export function LazyAccountMenu(props: { name: string; phone?: string; onSignOut?: () => void }) {
  const [wanted, setWanted] = useState(false);
  if (!wanted) return <AccountTrigger name={props.name} onIntent={() => setWanted(true)} />;
  return <AccountMenu {...props} initialOpen />;
}
