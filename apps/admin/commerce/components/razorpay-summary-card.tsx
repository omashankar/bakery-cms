"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import type { RazorpayStatus } from "@/apps/admin/commerce/components/razorpay-keys-card";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

/**
 * Whether online payments are working, and a way through to fix them.
 *
 * The Payments screen used to carry the whole keys FORM, and so did the Razorpay
 * gateway page once both existed — the same three inputs in two places, with no
 * indication which was authoritative. The form lives on the gateway page now
 * (which is where an admin looking for "Razorpay" navigates); this reports the
 * state and links there.
 *
 * It still surfaces a rejection loudly, because that is the one thing an
 * operator needs to see without going looking.
 */
export function RazorpaySummaryCard() {
  const [status, setStatus] = useState<RazorpayStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/razorpay/config?verify=1")
      .then((res) => (noteAuthStatus(res.status) ? null : res.ok ? res.json() : null))
      .then((next: RazorpayStatus | null) => {
        if (!cancelled && next) setStatus(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const mode = status?.testMode === true ? " · Test" : status?.testMode === false ? " · Live" : "";

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Online payments — Razorpay</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            API keys, webhook secret and connection status.
          </p>
        </div>
        {status ? (
          !status.configured ? (
            <Badge className="shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Not connected
            </Badge>
          ) : status.verified === true ? (
            <Badge variant="accent" className="shrink-0">
              Connected{mode}
            </Badge>
          ) : status.verified === false ? (
            <Badge variant="destructive" className="shrink-0">
              Keys rejected
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">
              Keys set · unverified
            </Badge>
          )
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {status?.verified === false ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-muted-foreground">
              <span className="font-medium text-destructive">
                Razorpay did not accept these keys.
              </span>{" "}
              Online payments will fail at checkout until this is fixed.
            </p>
          </div>
        ) : null}

        {status?.configured && status.verified !== false && !status.webhookConfigured ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">No webhook secret.</span> A payment
              whose customer closed the tab never becomes an order, and refunds stay stuck at
              “processing”.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Three states, not two. `status` is null both while the fetch is in
              flight and when it fails, and treating that as "no keys" told a
              perfectly configured shop that online payment was unavailable —
              every page load, for as long as the request took. */}
          <p className="text-sm text-muted-foreground">
            {!status
              ? "Checking the connection…"
              : status.configured
                ? `Key ${status.keyId}${status.source === "env" ? " (from .env.local)" : ""}`
                : "No keys yet — online payment is unavailable at checkout."}
          </p>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={routes.admin.commerce.gateway("razorpay")} />}
          >
            {status?.configured ? "Manage keys" : "Connect Razorpay"}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
