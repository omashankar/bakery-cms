import { CheckIcon, MinusIcon } from "lucide-react";

import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { MarketingShell } from "./components/marketing-shell";
import { Container, Eyebrow, Section, SectionHeading } from "./components/section";
import { LinkButton } from "./components/link-button";
import { pricingFaqs, pricingTiers, type PricingTier } from "./pricing-data";

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
            <p className="mt-1 text-sm text-muted-foreground">
              Priced to the size of your shop
            </p>
          </>
        )}
      </div>

      <LinkButton
        href={tier.cta.href}
        variant={tier.featured ? "primary" : "secondary"}
        className="mt-6 w-full justify-center"
      >
        {tier.cta.label}
      </LinkButton>

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

export function PricingPage() {
  return (
    <MarketingShell>
      <Section className="pb-10 pt-14 md:pb-12 md:pt-20">
        <Container>
          <SectionHeading
            eyebrow="Pricing"
            title="Pay for the shop you have, not the one you might have"
            description="Every plan is the whole product — the storefront, the admin, the orders. What changes is how much of the catalogue and how many of the extras you actually sell."
          />
        </Container>
      </Section>

      <Section className="py-0 md:py-0">
        <Container>
          <div className="grid items-stretch gap-6 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <TierCard key={tier.name} tier={tier} />
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
            Not sure which one? Start on the smallest. Moving up is a settings change, not a
            migration — the modules simply switch on.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-10">
          <SectionHeading eyebrow="Questions" title="Before you decide" />

          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {pricingFaqs.map((faq) => (
              <div key={faq.question} className="flex flex-col gap-2">
                <h3 className="text-base font-semibold tracking-tight">{faq.question}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="pb-24 pt-0">
        <Container>
          <div className="flex flex-col items-center gap-6 rounded-3xl bg-[#241810] px-8 py-14 text-center text-[#E7DDD1]">
            <Eyebrow className="border-white/15 bg-white/10 text-[#E7DDD1]">Next step</Eyebrow>
            <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
              See it running before you talk numbers
            </h2>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-[#B7A895] md:text-base">
              The storefront and the admin panel are both live on this deployment. Open them,
              place an order, watch it arrive in the dashboard.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <LinkButton href={routes.store.home} variant="primary">
                View the store
              </LinkButton>
              <LinkButton href={routes.store.contact} variant="secondary">
                Talk to us
              </LinkButton>
            </div>
          </div>
        </Container>
      </Section>
    </MarketingShell>
  );
}
