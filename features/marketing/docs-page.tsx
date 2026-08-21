import { AlertTriangleIcon, ArrowRightIcon } from "lucide-react";

import { routes } from "@/constants/routes";
import { MarketingShell } from "./components/marketing-shell";
import { Container, Eyebrow, Section, SectionHeading } from "./components/section";
import { LinkButton } from "./components/link-button";
import { docChapters, type DocStep } from "./docs-data";

function Step({ step, index }: { step: DocStep; index: number }) {
  return (
    <li className="relative flex gap-5 pb-8 last:pb-0">
      {/* The rail: a real sequence, so the numbering carries information. */}
      <div className="flex flex-col items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F6EEE3] text-sm font-semibold text-[#7A4D2B]">
          {index + 1}
        </span>
        <span className="mt-2 w-px flex-1 bg-border last:hidden" aria-hidden />
      </div>

      <div className="flex flex-1 flex-col gap-2 pt-1">
        <h3 className="text-base font-semibold tracking-tight">{step.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        {step.where ? (
          <p className="text-sm">
            {step.where.href ? (
              <a
                href={step.where.href}
                className="inline-flex items-center gap-1.5 font-medium text-[#7A4D2B] underline-offset-4 hover:underline"
              >
                {step.where.label}
                <ArrowRightIcon className="size-3.5" aria-hidden />
              </a>
            ) : (
              <span className="font-medium text-[#7A4D2B]">{step.where.label}</span>
            )}
          </p>
        ) : null}

        {step.caution ? (
          <p className="mt-1 flex items-start gap-2.5 rounded-xl border border-[#EADFCF] bg-[#FDF8F1] px-3.5 py-2.5 text-sm leading-relaxed text-[#6b5540]">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-[#B4873F]" aria-hidden />
            <span>{step.caution}</span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function DocsPage() {
  return (
    <MarketingShell>
      <Section className="pb-10 pt-14 md:pb-12 md:pt-20">
        <Container>
          <SectionHeading
            eyebrow="Documentation"
            title="Running your shop"
            description="A guide to the admin panel, in the order you will actually need it — from naming the shop to taking your first order to keeping the whole thing safe."
          />
        </Container>
      </Section>

      {/* Contents. Built from the same data as the chapters, so it cannot drift. */}
      <Section className="py-0 md:py-0">
        <Container>
          <nav aria-label="Contents" className="rounded-3xl border border-border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              On this page
            </p>
            <ol className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {docChapters.map((chapter, i) => (
                <li key={chapter.id}>
                  <a
                    href={`#${chapter.id}`}
                    className="group flex items-baseline gap-2.5 text-sm font-medium transition-colors hover:text-[#7A4D2B]"
                  >
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="group-hover:underline group-hover:underline-offset-4">
                      {chapter.title}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </Container>
      </Section>

      {docChapters.map((chapter) => (
        <Section key={chapter.id} id={chapter.id} className="py-14 md:py-16">
          <Container className="flex flex-col gap-8 lg:flex-row lg:gap-16">
            <div className="flex flex-col gap-3 lg:w-72 lg:shrink-0">
              <h2 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">
                {chapter.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{chapter.summary}</p>
            </div>

            <ol className="flex-1">
              {chapter.steps.map((step, i) => (
                <Step key={step.title} step={step} index={i} />
              ))}
            </ol>
          </Container>
        </Section>
      ))}

      <Section className="pb-24 pt-4">
        <Container>
          <div className="flex flex-col items-center gap-6 rounded-3xl bg-[#241810] px-8 py-14 text-center text-[#E7DDD1]">
            <Eyebrow className="border-white/15 bg-white/10 text-[#E7DDD1]">Still stuck?</Eyebrow>
            <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Ask, and we will walk you through it
            </h2>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-[#B7A895] md:text-base">
              Nothing here is a one-way door. Prices, photographs, pages and coupons can all be
              changed back, and maintenance mode lets you close the shop while you work.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <LinkButton href={routes.admin.dashboard} variant="primary">
                Open the admin
              </LinkButton>
              <LinkButton href={routes.store.contact} variant="secondary">
                Contact support
              </LinkButton>
            </div>
          </div>
        </Container>
      </Section>
    </MarketingShell>
  );
}
