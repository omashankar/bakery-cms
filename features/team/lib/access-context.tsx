"use client";

import { createContext, useContext, useMemo } from "react";

import type { Permission } from "./permissions";

/**
 * What the signed-in member may do, for the BROWSER: which menu items to draw,
 * which buttons to offer, which screens to open.
 *
 * This is a courtesy, never a defence. The server read it from the database for
 * this request (app/(admin)/layout.tsx) and checks it again on every API call;
 * a member who edits this in their browser gets buttons that answer 403.
 */
export interface ClientAccess {
  userId: string;
  email: string;
  name: string;
  role: string;
  roleName: string;
  isOwner: boolean;
  permissions: Permission[];
}

interface AccessValue {
  access: ClientAccess | null;
  /** Holds this permission. */
  can: (permission: Permission) => boolean;
  /** Holds at least one of these. */
  canAny: (permissions: readonly Permission[]) => boolean;
}

const AccessContext = createContext<AccessValue | null>(null);

export function AccessProvider({
  access,
  children,
}: {
  access: ClientAccess | null;
  children: React.ReactNode;
}) {
  const value = useMemo<AccessValue>(() => {
    const held = new Set<string>(access?.permissions ?? []);
    return {
      access,
      can: (p) => held.has(p),
      canAny: (list) => list.some((p) => held.has(p)),
    };
  }, [access]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

const NOBODY: AccessValue = { access: null, can: () => false, canAny: () => false };

/**
 * Outside the admin shell — a test rendering one screen alone, the storefront —
 * there is no member, so nothing is permitted.
 */
export function useAccess(): AccessValue {
  return useContext(AccessContext) ?? NOBODY;
}

export function useCan(permission: Permission): boolean {
  return useAccess().can(permission);
}
