import { CheckIcon, MinusIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { LinkButton } from "./link-button";
import { vendorContact } from "../landing-data";
import { pricingTiers, type PricingTier } from "../pricing-data";

function TierCard({ tier }: { tier: PricingTier }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-3xl border bg-card p-7 shadow-sm transition-shadow hover:shadow-md",
        tier.featured
          ? "border-[#D4A373] ring-1 ring-[#D4A373]/40 lg:-my-4 lg:py-11"
          : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight">{tier.name}</h3>
        {tier.featured ? (
          <span className="rounded-full bg-[#F6EEE3] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#8a6a45]">
            Most chosen
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tier.audience}</p>

      <div className="mt-6 flex min-h-[4.5rem] flex-col justify-center">
        {tier.price ? (
          <>
            <p className="text-4xl font-semibold tracking-tight">{tier.price.amount}</p>
            <p className="mt-1 text-sm text-muted-foreground">{tier.price.period}</p>
          </>
        ) : (
          <>
            {/*
              No number, and that is the honest state rather than a gap. A price
              is a commitment; publishing a wrong one is far harder to withdraw
              than publishing none. `pricing-data.ts` says how to add one.
            */}
            <p className="text-2xl font-semibold tracking-tight">Let&rsquo;s talk</p>
            <p className="mt-1 text-sm text-muted-foreground">Priced to the size of your shop</p>
          </>
        )}
      </div>

      {/*
        A button only when there is somewhere of OURS to send people. These
        pointed at the shop's contact form. Until `vendorContact` is set this
        says so plainly rather than inviting a click it cannot honour.
      */}
      {vendorContact ? (
        <LinkButton
          href={vendorContact}
          variant={tier.featured ? "primary" : "secondary"}
          className="mt-6 w-full justify-center"
        >
          Talk to us
        </LinkButton>
      ) : (
        <p className="mt-6 rounded-full border border-dashed border-border px-5 py-3 text-center text-sm text-muted-foreground">
          Contact details coming soon
        </p>
      )}

      <ul className="mt-7 flex flex-col gap-3 border-t border-border pt-6">
        {tier.includes.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-[#7A4D2B]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
        {tier.excludes?.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground/70"
          >
            <MinusIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The plans, as a section of the landing page rather than a page of their own.
 *
 * Pricing was briefly `/platform/pricing`. Three cards and a caption is not a
 * page's worth of content, and splitting it off meant someone reading the
 * feature sections had to leave them to find out what it costs — which is the
 * one question those sections are building toward.
 */
export function PricingTiers() {
  return (
    <>
      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        {pricingTiers.map((tier) => (
          <TierCard key={tier.name} tier={tier} />
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
        Not sure which one? Start on the smallest. Moving up is a settings change, not a
        migration — the modules simply switch on.
      </p>
    </>
  );
}
