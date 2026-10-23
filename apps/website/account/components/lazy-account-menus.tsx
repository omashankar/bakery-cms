"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { User } from "lucide-react";
import { getAccountInitials } from "@/apps/website/account/lib/account-initials";
import {
  ACCOUNT_TRIGGER_CLASS,
  GUEST_ICON_CLASS,
  GUEST_TRIGGER_CLASS,
} from "./account-trigger-classes";

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

function GuestTrigger({ onIntent }: { onIntent?: () => void }) {
  return (
    <button
      type="button"
      aria-label="Login"
      aria-haspopup="menu"
      className={GUEST_TRIGGER_CLASS}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      onClick={onIntent}
    >
      <User className={GUEST_ICON_CLASS} />
    </button>
  );
}

function AccountTrigger({ name, onIntent }: { name: string; onIntent?: () => void }) {
  return (
    <button
      type="button"
      aria-label={name ? `${name}'s account` : "Your account"}
      aria-haspopup="menu"
      className={ACCOUNT_TRIGGER_CLASS}
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
