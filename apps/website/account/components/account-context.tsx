"use client";

import { createContext, useContext } from "react";

/**
 * The signed-in customer as the SERVER read it, for the account pages' first
 * paint. The layout already loads the account (it redirects a guest), so the
 * name, email and phone are known before any browser code runs — the pages
 * used to wait for a client session check and paint nothing until it came
 * back, which is the blank flash between tabs.
 */
export interface AccountProfile {
  name: string;
  email: string;
  phone: string;
}

const AccountContext = createContext<AccountProfile | null>(null);

export const AccountProfileProvider = AccountContext.Provider;

export function useAccountProfile(): AccountProfile | null {
  return useContext(AccountContext);
}

/** What the nav and the avatar call someone with no name set: the email's local part. */
export function displayNameOf(profile: AccountProfile): string {
  return profile.name.trim() || profile.email.split("@")[0] || "";
}
