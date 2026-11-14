import {
  ArrowRightIcon,
  CheckIcon,
  SparklesIcon,
} from "lucide-react";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import { AnalyticsMockup } from "./components/analytics-mockup";
import { BrowserFrame } from "./components/browser-frame";
import { BuilderMockup } from "./components/builder-mockup";
import { DashboardMockup } from "./components/dashboard-mockup";
import { FaqSection } from "./components/faq-section";
import { LinkButton } from "./components/link-button";
import { MarketingShell } from "./components/marketing-shell";
import { PricingTiers } from "./components/pricing-tiers";
import { Container, Eyebrow, Section, SectionHeading } from "./components/section";
import {
  adminModules,
  builderCapabilities,
  businessTypes,
  commerceFeatures,
  ctaLinks,
  customerJourney,
  type IconType,
  paymentMethods,
  reportMetrics,
  howItWorks,
  techStack,
  whyChoose,
} from "./landing-data";


/** Four things a shop owner can check, not four adjectives. */
const heroTrust = ["No commission on orders", "UPI & cash on delivery", "Works on every phone", "Set up for you"];

function IconTile({ icon: Icon, className }: { icon: IconType; className?: string }) {
  return (
    <span
      aria-hidden
      className={
        "flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#F6EEE3] text-[#7A4D2B] transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground " +
        (className ?? "")
      }
    >
      <Icon className="size-6" />
    </span>
  );
}

export function LandingPage() {
  return (
    <MarketingShell>
        {/* ============================================================ */}
        {/* SECTION 1  — Hero                                             */}
        {/* ============================================================ */}
        <section className="relative overflow-hidden">
          <Container className="grid items-center gap-12 py-16 md:py-24 xl:grid-cols-[1.05fr_1fr] xl:gap-16">
            <ScrollReveal className="flex flex-col items-start gap-6">
              <Eyebrow>Complete Bakery Platform</Eyebrow>
              <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                Complete Bakery Business{" "}
                <span className="text-[#7A4D2B]">Management Platform</span>
              </h1>
              <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                Your own website and admin — products, orders, kitchen, delivery and
                payments in one place, without handing a marketplace a cut of every order.
              </p>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <LinkButton href={ctaLinks.demo} variant="primary" size="lg" className="w-full sm:w-auto">
                  Book a Demo
                  <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                </LinkButton>
                <LinkButton href={ctaLinks.store} variant="secondary" size="lg" className="w-full sm:w-auto">
                  View Store
                </LinkButton>
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
                {heroTrust.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <span className="flex size-4 items-center justify-center rounded-full bg-[#E9F1E4] text-[#3d6e35]">
                      <CheckIcon className="size-2.5" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </ScrollReveal>

            <ScrollReveal delay={120} className="relative min-w-0">
              <div
                aria-hidden
                className="absolute -inset-6 -z-10 rounded-full bg-[#D4A373]/20 blur-[90px]"
              />
              <BrowserFrame>
                <DashboardMockup />
              </BrowserFrame>
            </ScrollReveal>
          </Container>
        </section>

        {/* ============================================================ */}
        {/* SECTION 2  — Why Choose Bakery CMS                           */}
        {/* ============================================================ */}
        <Section id="features" className="bg-white">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Why Bakery CMS"
                title="Built for bakeries that mean business"
                description="Not a list of buzzwords — what changes for your shop on the first day."
              />
            </ScrollReveal>
            {/*
              The first reason is the one that sells — what a marketplace keeps
              from every order — so it gets the room, and the rest sit beside it.
            */}
            <div className="mt-14 grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <ScrollReveal className="h-full">
                <div className="relative flex h-full flex-col justify-between gap-8 overflow-hidden rounded-3xl bg-primary p-8 text-white shadow-[0_30px_70px_-30px_rgba(74,51,36,0.6)] md:p-10">
                  <span aria-hidden className="absolute -right-20 -top-20 size-64 rounded-full bg-[#D4A373]/25 blur-2xl" />
                  <span className="relative inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-[#FAF1E4]">
                    <SparklesIcon className="size-3.5" aria-hidden />
                    The one that pays for itself
                  </span>
                  <div className="relative">
                    <p className="font-heading text-7xl font-semibold leading-none tracking-tight md:text-8xl">0%</p>
                    <p className="mt-3 font-heading text-2xl font-semibold">commission on your orders</p>
                    <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#EADFD1]">
                      A marketplace keeps a share of every order that comes through it. On your own
                      website the money goes to your own Razorpay account — Razorpay&apos;s
                      standard payment fee, and nothing more.
                    </p>
                  </div>
                  <LinkButton
                    href={ctaLinks.demo}
                    variant="secondary"
                    size="lg"
                    className="relative w-full border-transparent bg-white text-[#7A4D2B] hover:bg-[#F6EEE3] sm:w-fit"
                  >
                    Book a Demo
                    <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </LinkButton>
                </div>
              </ScrollReveal>
              <StaggerReveal className="grid gap-4 sm:grid-cols-2">
                {whyChoose.slice(1).map((w) => (
                  <div
                    key={w.title}
                    className="group flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4A373]/60 hover:shadow-md"
                  >
                    <IconTile icon={w.icon} className="size-11 rounded-xl [&_svg]:size-5" />
                    <div className="flex flex-col gap-1 pt-0.5">
                      <h3 className="font-heading text-base font-semibold">{w.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{w.description}</p>
                    </div>
                  </div>
                ))}
              </StaggerReveal>
            </div>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 3  — How it works                                    */}
        {/* ============================================================ */}
        {/*
          It was a "Roadmap" whose six items all said Available — a second
          feature list wearing a timeline. What a shop owner asks at this
          point is what happens after they say yes.
        */}
        <Section id="how-it-works" className="bg-background">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="How it works"
                title="From first call to first order"
                description="You run the shop. We set the website up for you, so you can start taking orders without learning a new tool first."
              />
            </ScrollReveal>
            <StaggerReveal className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
              {howItWorks.map((step, i) => (
                <div
                  key={step.title}
                  className="relative flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-7 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <IconTile icon={step.icon} />
                    <span className="font-heading text-4xl font-semibold text-[#A07A4E]" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-heading text-lg font-semibold">
                      <span className="sr-only">Step {i + 1}: </span>
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </StaggerReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 4  — Customer Journey                                 */}
        {/* ============================================================ */}
        <Section id="journey" className="bg-white">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Customer Journey"
                title="A seamless path from browse to review"
                description="Every step of the buying experience is thoughtfully designed to turn visitors into loyal customers."
              />
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <ol className="mx-auto mt-14 grid max-w-5xl grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-9">
                {customerJourney.map((step, i) => (
                  <li
                    key={step.label}
                    className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card px-2 py-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4A373]"
                  >
                    <span className="relative flex size-10 items-center justify-center rounded-full bg-[#F6EEE3] text-[#7A4D2B] transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <step.icon className="size-4.5" aria-hidden />
                      <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {i + 1}
                      </span>
                    </span>
                    <span className="text-xs font-medium leading-tight sm:text-sm">{step.label}</span>
                  </li>
                ))}
              </ol>
            </ScrollReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 5  — Website Builder                                  */}
        {/* ============================================================ */}
        <Section className="bg-background">
          <Container>
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <ScrollReveal className="order-2 min-w-0 lg:order-1">
                <BrowserFrame url="yourbakery.in/admin/builders/homepage">
                  <BuilderMockup />
                </BrowserFrame>
              </ScrollReveal>
              <ScrollReveal delay={80} className="order-1 flex flex-col gap-6 lg:order-2">
                <SectionHeading
                  align="left"
                  eyebrow="Website Builder"
                  title="Design your storefront, visually"
                  description="Arrange, style, and publish every section of your website with an intuitive drag-and-drop builder — no code required."
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {builderCapabilities.map((cap) => (
                    <div
                      key={cap.title}
                      className="flex h-full items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-[#F6EEE3] text-[#7A4D2B]">
                        <cap.icon className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{cap.title}</p>
                        <p className="text-[13px] leading-snug text-muted-foreground">{cap.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollReveal>
            </div>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 6  — Admin Dashboard Modules                          */}
        {/* ============================================================ */}
        <Section id="modules" className="bg-white">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Admin Modules"
                title="One dashboard to run the whole business"
                description="Sixteen modules — from the counter to the kitchen to the rider — each one a screen your team actually uses."
              />
            </ScrollReveal>
            <StaggerReveal className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {adminModules.map((m) => (
                <div
                  key={m.title}
                  className="group flex h-full items-start gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4A373]/60 hover:shadow-md"
                >
                  <IconTile icon={m.icon} className="size-10 rounded-xl [&_svg]:size-5" />
                  <div className="flex flex-col gap-1">
                    <h3 className="font-heading text-base font-semibold">{m.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{m.description}</p>
                  </div>
                </div>
              ))}
            </StaggerReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 7  — Reports & Analytics                             */}
        {/* ============================================================ */}
        <Section id="analytics" className="bg-background">
          <Container>
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <ScrollReveal className="flex flex-col gap-6">
                <SectionHeading
                  align="left"
                  eyebrow="Reports & Analytics"
                  title="Insights that drive better decisions"
                  description="Track the numbers that matter with a clean, real-time analytics dashboard built for busy owners."
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {reportMetrics.map((metric) => (
                    <div
                      key={metric}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-3 text-sm font-medium shadow-sm"
                    >
                      <CheckIcon className="size-4 shrink-0 text-[#3d6e35]" strokeWidth={2.5} />
                      {metric}
                    </div>
                  ))}
                </div>
              </ScrollReveal>
              <ScrollReveal delay={80} className="min-w-0">
                <BrowserFrame url="yourbakery.in/admin/reports">
                  <AnalyticsMockup />
                </BrowserFrame>
              </ScrollReveal>
            </div>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 8  — Commerce Features                                */}
        {/* ============================================================ */}
        <Section id="commerce" className="bg-white">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Commerce"
                title="Everything it takes to sell, built in"
                description="From stock to invoices, every part of selling online is included and ready to configure."
              />
            </ScrollReveal>
            <StaggerReveal className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {commerceFeatures.map((c) => (
                <div
                  key={c.title}
                  className="group flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4A373]/60 hover:shadow-md"
                >
                  <IconTile icon={c.icon} className="size-11 rounded-xl [&_svg]:size-5" />
                  <div className="flex flex-col gap-1 pt-0.5">
                    <h3 className="font-heading text-base font-semibold">{c.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{c.description}</p>
                  </div>
                </div>
              ))}
            </StaggerReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 9  — Payment System                                   */}
        {/* ============================================================ */}
        <Section id="payments" className="bg-background">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Payments"
                title="Accept payments, every way customers pay"
                description="Online payments land in your own Razorpay account; cash on delivery needs nothing at all."
              />
            </ScrollReveal>
            {/* One strip of six, not a third card grid in a row: these are
                names a customer recognises, not features to read about. */}
            <StaggerReveal className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {paymentMethods.map((p) => (
                <div
                  key={p.name}
                  className="group flex h-full flex-col items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4A373]/60 hover:shadow-md"
                >
                  <IconTile icon={p.icon} className="size-11 rounded-xl [&_svg]:size-5" />
                  <div>
                    <p className="font-heading text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.note}</p>
                  </div>
                </div>
              ))}
            </StaggerReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 10 — Any Business (business types)                  */}
        {/* ============================================================ */}
        <Section id="business-types" className="bg-white">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Any Business"
                title="One CMS, built for every business"
                description="There is no business type to choose. Name your products in your own words, build the options they come in — size, colour, flavour, capacity — and sell whatever mix you like from one catalogue. One codebase, any business, no redesign."
              />
            </ScrollReveal>
            <StaggerReveal className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {businessTypes.map((b) => (
                <div
                  key={b.name}
                  className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4A373]/60 hover:shadow-md"
                >
                  <IconTile icon={b.icon} className="size-11 rounded-xl [&_svg]:size-5" />
                  <span className="font-heading text-base font-semibold">{b.name}</span>
                </div>
              ))}
            </StaggerReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 11 — Pricing                                         */}
        {/* ============================================================ */}
        <Section id="pricing" className="bg-background">
          <Container className="flex flex-col gap-12">
            <ScrollReveal>
              <SectionHeading
                eyebrow="Pricing"
                title="Pay for the shop you have, not the one you might have"
                description="Every plan is the whole product — the storefront, the admin, the orders. What changes is how much of the catalogue and how many of the extras you actually sell."
              />
            </ScrollReveal>
            <ScrollReveal>
              <PricingTiers />
            </ScrollReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 12 — FAQ                                             */}
        {/* ============================================================ */}
        <Section id="faq" className="bg-white">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="FAQ"
                title="Questions, answered"
                description="Everything you need to know before getting started with Bakery CMS."
              />
            </ScrollReveal>
            <ScrollReveal delay={80} className="mt-12">
              <FaqSection />
            </ScrollReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 13 — Technology                                      */}
        {/* ============================================================ */}
        <Section className="bg-background !py-16">
          <Container>
            <ScrollReveal className="flex flex-col items-center gap-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Eyebrow>Technology</Eyebrow>
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Built on a modern, trusted foundation
                </h2>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {techStack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:border-[#D4A373]"
                  >
                    <span className="size-1.5 rounded-full bg-[#D4A373]" />
                    {tech}
                  </span>
                ))}
              </div>
            </ScrollReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 14 — Call To Action                                  */}
        {/* ============================================================ */}
        <Section className="bg-white">
          <Container>
            <ScrollReveal>
              <div className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-16 text-center shadow-[0_30px_70px_-30px_rgba(74,51,36,0.6)] md:px-16 md:py-20">
                <span
                  aria-hidden
                  className="absolute -right-16 -top-16 size-64 rounded-full bg-[#D4A373]/25 blur-2xl"
                />
                <span
                  aria-hidden
                  className="absolute -bottom-20 -left-16 size-64 rounded-full bg-[#D4A373]/15 blur-2xl"
                />
                <div className="relative flex flex-col items-center gap-6">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-[#FAF1E4]">
                    <SparklesIcon className="size-3.5" />
                    Ready when you are
                  </span>
                  <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white md:text-[2.75rem] md:leading-[1.1]">
                    Ready to build your bakery business?
                  </h2>
                  <p className="max-w-xl text-pretty text-[15px] leading-relaxed text-[#EADFD1] md:text-lg">
                    Look around the live storefront, then book a demo — we will walk you
                    through the admin and set your shop up.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <LinkButton
                      href={ctaLinks.demo}
                      variant="secondary"
                      size="lg"
                      className="border-transparent bg-white text-[#7A4D2B] hover:bg-[#F6EEE3]"
                    >
                      Book a Demo
                      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </LinkButton>
                    <LinkButton
                      href={ctaLinks.store}
                      variant="ghost"
                      size="lg"
                      className="border border-white/25 text-white hover:bg-white/10"
                    >
                      View Store
                    </LinkButton>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </Container>
        </Section>
    </MarketingShell>
  );
}
