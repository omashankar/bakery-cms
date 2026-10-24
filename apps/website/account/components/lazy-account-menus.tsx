"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ACCOUNT_TRIGGER_CLASS, AccountTriggerFace } from "./account-trigger";

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

type AccountMenuComponent = typeof import("./account-menu").AccountMenu;

function GuestTrigger({ onIntent }: { onIntent?: () => void }) {
  return (
    <button
      type="button"
      aria-label="Login"
      aria-haspopup="menu"
      className={ACCOUNT_TRIGGER_CLASS}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      onClick={onIntent}
    >
      <AccountTriggerFace name={null} />
    </button>
  );
}

function AccountTrigger({
  name,
  avatarUrl,
  onIntent,
}: {
  name: string;
  avatarUrl?: string;
  onIntent?: () => void;
}) {
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
      <AccountTriggerFace name={name} avatarUrl={avatarUrl} />
    </button>
  );
}

export function LazyGuestMenu() {
  const [wanted, setWanted] = useState(false);
  if (!wanted) return <GuestTrigger onIntent={() => setWanted(true)} />;
  return <GuestMenu initialOpen />;
}

export function LazyAccountMenu(props: {
  name: string;
  phone?: string;
  avatarUrl?: string;
  onSignOut?: () => void;
}) {
  /*
    THE STAND-IN STAYS UNTIL THE MENU HAS ARRIVED. This used `next/dynamic`,
    whose loading placeholder cannot be handed props — it drew the trigger with
    no name, so every first hover showed "U" (the initials of nobody) and no
    photo until the menu's code came in. The module is imported here instead,
    and the real menu replaces this button only once it can.
  */
  const [Menu, setMenu] = useState<AccountMenuComponent | null>(null);
  if (!Menu) {
    return (
      <AccountTrigger
        name={props.name}
        avatarUrl={props.avatarUrl}
        onIntent={() =>
          void import("./account-menu").then((module) => setMenu(() => module.AccountMenu))
        }
      />
    );
  }
  return <Menu {...props} initialOpen />;
}
