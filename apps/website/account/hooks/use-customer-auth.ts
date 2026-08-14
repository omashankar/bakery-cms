"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCustomerSession,
  syncCustomerSession,
  type CustomerSession,
} from "@/apps/website/account/lib/customer-session";
import { routes } from "@/constants/routes";

/**
 * Who is signed in, for the account pages that require it.
 *
 * The redirect waits for the SERVER's answer. It used to fire on the browser's
 * cached copy alone, which is empty on a cold load — a first paint of
 * /account/orders in a new tab bounced a perfectly signed-in customer back to
 * the homepage with the login modal open, because the cookie had not been
 * asked about yet.
 *
 * The cached copy is still used for the first render, so a returning customer
 * sees their own page rather than a spinner while the round trip happens.
 */
export function useCustomerAuth() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(() => getCustomerSession());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const confirmed = await syncCustomerSession();
      if (cancelled) return;

      if (!confirmed) {
        // No dedicated login page — send them home and open the login modal.
        router.replace(`${routes.store.home}?login=1`);
        return;
      }

      setSession(confirmed);
      setReady(true);
    })();

    // Keep up with a sign-out (or a profile change) made anywhere else.
    const onChange = () => {
      const current = getCustomerSession();
      if (!current) {
        router.replace(`${routes.store.home}?login=1`);
        return;
      }
      setSession(current);
    };
    window.addEventListener("bakery-customer-session-updated", onChange);

    return () => {
      cancelled = true;
      window.removeEventListener("bakery-customer-session-updated", onChange);
    };
  }, [router]);

  return { session, ready };
}
