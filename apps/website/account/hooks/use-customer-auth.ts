"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCustomerSession,
  type CustomerSession,
} from "@/apps/website/account/lib/customer-session";
import { routes } from "@/constants/routes";

export function useCustomerAuth() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => {
      const current = getCustomerSession();
      if (!current) {
        // No dedicated login page — send them home and open the login modal.
        router.replace(`${routes.store.home}?login=1`);
        return;
      }
      setSession(current);
      setReady(true);
    };

    load();
    window.addEventListener("bakery-customer-session-updated", load);
    return () => window.removeEventListener("bakery-customer-session-updated", load);
  }, [router]);

  return { session, ready };
}
