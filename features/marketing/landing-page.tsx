import { Fragment } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  GlobeIcon,
  MailIcon,
  MessageCircleIcon,
  SendIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import { AnalyticsMockup } from "./components/analytics-mockup";
import { BrowserFrame } from "./components/browser-frame";
import { BuilderMockup } from "./components/builder-mockup";
import { DashboardMockup } from "./components/dashboard-mockup";
import { FaqSection } from "./components/faq-section";
import { LinkButton } from "./components/link-button";
import { Logo } from "./components/logo";
import { Container, Eyebrow, Section, SectionHeading } from "./components/section";
import { SiteHeader } from "./components/site-header";
import { WeddingMockup } from "./components/wedding-mockup";
import {
  adminModules,
  builderCapabilities,
  businessTypes,
  commerceFeatures,
  ctaLinks,
  customerJourney,
  footerColumns,
  type IconType,
  paymentMethods,
  reportMetrics,
  roadmap,
  techStack,
  trustedFeatures,
  weddingBlocks,
  whyChoose,
} from "./landing-data";

const brandVars = {
  "--background": "#FAF9F7",
  "--card": "#FFFFFF",
  "--foreground": "#26201B",
  "--primary": "#7A4D2B",
  "--primary-foreground": "#FFFFFF",
  "--secondary": "#F3EEE7",
  "--secondary-foreground": "#7A4D2B",
  "--muted": "#F3EEE7",
  "--muted-foreground": "#776E62",
  "--accent": "#F3EEE7",
  "--accent-foreground": "#7A4D2B",
  "--border": "#ECE6DC",
  "--border-soft": "#ECE6DC",
  "--ring": "#D4A373",
  "--brand-accent": "#D4A373",
} as React.CSSProperties;

const heroTrust = ["Trusted Bakery CMS", "Modern UI", "Future Ready", "Responsive"];

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
    <div
      className="storefront-light min-h-screen bg-background font-sans text-foreground"
      style={brandVars}
    >
      <SiteHeader />

      <main>
        {/* ============================================================ */}
        {/* SECTION 2 — Hero                                             */}
        {/* ============================================================ */}
        <section className="relative overflow-hidden">
          <Container className="grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <ScrollReveal className="flex flex-col items-start gap-6">
              <Eyebrow>Complete Bakery Platform</Eyebrow>
              <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                Complete Bakery Business{" "}
                <span className="text-[#7A4D2B]">Management Platform</span>
              </h1>
              <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                Manage your website, products, orders, inventory, customers, delivery,
                payments, and marketing from one modern dashboard.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <LinkButton href={ctaLinks.admin} variant="primary" size="lg">
                  Explore Admin
                  <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                </LinkButton>
                <LinkButton href={ctaLinks.store} variant="secondary" size="lg">
                  View Store
                </LinkButton>
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                {heroTrust.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <span className="flex size-4 items-center justify-center rounded-full bg-[#E9F1E4] text-[#4f8a45]">
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
              <div className="absolute -bottom-5 -left-4 hidden items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:flex">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#E9F1E4] text-[#4f8a45]">
                  <TrendingUpIcon className="size-5" />
                </span>
                <div>
                  <p className="font-heading text-sm font-semibold leading-none">+18.6%</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">revenue this month</p>
                </div>
              </div>
            </ScrollReveal>
          </Container>
        </section>

        {/* ============================================================ */}
        {/* SECTION 3 — Trusted Features                                 */}
        {/* ============================================================ */}
        <Section id="features" className="bg-white">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Features"
                title="Everything your bakery needs, in one place"
                description="A modern toolkit that runs your storefront and your back office — beautifully connected from day one."
              />
            </ScrollReveal>
            <StaggerReveal className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trustedFeatures.map((f) => (
                <div
                  key={f.title}
                  className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4A373]/60 hover:shadow-md"
                >
                  <IconTile icon={f.icon} />
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-heading text-lg font-semibold">{f.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                  </div>
                </div>
              ))}
            </StaggerReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 3.5 — Any Business (business types)                  */}
        {/* ============================================================ */}
        <Section id="business-types" className="bg-background">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Any Business"
                title="One CMS, built for every business"
                description="Bakery is the default template — but switch your Business Type in Settings and the entire storefront, labels, icons, and optional modules adapt instantly. One codebase, any business — no redesign."
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
        {/* SECTION 4 — Customer Journey                                 */}
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
              <div className="mt-14 flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
                {customerJourney.map((step, i) => (
                  <Fragment key={step.label}>
                    <div className="group inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4A373]">
                      <span className="flex size-6 items-center justify-center rounded-full bg-[#F6EEE3] text-[#7A4D2B] transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <step.icon className="size-3.5" />
                      </span>
                      <span className="text-sm font-medium">{step.label}</span>
                    </div>
                    {i < customerJourney.length - 1 ? (
                      <ChevronRightIcon className="size-4 shrink-0 text-[#C9B79E]" aria-hidden />
                    ) : null}
                  </Fragment>
                ))}
              </div>
            </ScrollReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 5 — Admin Dashboard Modules                          */}
        {/* ============================================================ */}
        <Section id="modules" className="bg-background">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Admin Modules"
                title="One dashboard to run the whole business"
                description="Fourteen purpose-built modules give you complete control over operations, content, and growth."
              />
            </ScrollReveal>
            <StaggerReveal className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {adminModules.map((m) => (
                <div
                  key={m.title}
                  className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4A373]/60 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <IconTile icon={m.icon} className="size-11 rounded-xl [&_svg]:size-5" />
                    <span className="rounded-full bg-[#F3EEE7] px-2.5 py-1 text-[11px] font-semibold text-[#8a6a45]">
                      {m.status}
                    </span>
                  </div>
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
        {/* SECTION 6 — Commerce Features                                */}
        {/* ============================================================ */}
        <Section id="commerce" className="bg-white">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Commerce"
                title="Enterprise-grade commerce, built in"
                description="From inventory to invoicing, every commerce capability your bakery needs is included and ready to configure."
              />
            </ScrollReveal>
            <StaggerReveal className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {commerceFeatures.map((c) => (
                <div
                  key={c.title}
                  className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4A373]/60 hover:shadow-md"
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
        {/* SECTION 7 — Website Builder                                  */}
        {/* ============================================================ */}
        <Section className="bg-background">
          <Container>
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <ScrollReveal className="order-2 min-w-0 lg:order-1">
                <BrowserFrame url="app.bakerycms.com/builder">
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
                      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
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
        {/* SECTION 8 — Wedding Builder                                  */}
        {/* ============================================================ */}
        <Section className="bg-white">
          <Container>
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <ScrollReveal className="flex flex-col gap-6">
                <SectionHeading
                  align="left"
                  eyebrow="Wedding Builder"
                  title="Dedicated pages for the big day"
                  description="Launch elegant, fully CMS-controlled wedding landing pages designed to win bespoke and celebration orders."
                />
                <div className="flex flex-wrap gap-2.5">
                  {weddingBlocks.map((block) => (
                    <span
                      key={block}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-sm"
                    >
                      <span className="size-1.5 rounded-full bg-[#D4A373]" />
                      {block}
                    </span>
                  ))}
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#F6EEE3] px-4 py-2 text-sm font-semibold text-[#8a6a45]">
                  <SparklesIcon className="size-4" />
                  Fully CMS Controlled
                </div>
              </ScrollReveal>
              <ScrollReveal delay={80} className="min-w-0">
                <BrowserFrame url="app.bakerycms.com/wedding">
                  <WeddingMockup />
                </BrowserFrame>
              </ScrollReveal>
            </div>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 9 — Payment System                                   */}
        {/* ============================================================ */}
        <Section id="payments" className="bg-background">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Payments"
                title="Accept payments, every way customers pay"
                description="A unified payment layer with the gateways and methods your customers already trust."
              />
            </ScrollReveal>
            <StaggerReveal className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {paymentMethods.map((p) => (
                <div
                  key={p.name}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4A373]/60 hover:shadow-md"
                >
                  <IconTile icon={p.icon} className="size-12 rounded-xl" />
                  <div>
                    <p className="font-heading text-base font-semibold">{p.name}</p>
                    <p className="text-[13px] text-muted-foreground">{p.note}</p>
                  </div>
                </div>
              ))}
            </StaggerReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 10 — Reports & Analytics                             */}
        {/* ============================================================ */}
        <Section id="analytics" className="bg-white">
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
                      <CheckIcon className="size-4 shrink-0 text-[#4f8a45]" strokeWidth={2.5} />
                      {metric}
                    </div>
                  ))}
                </div>
              </ScrollReveal>
              <ScrollReveal delay={80} className="min-w-0">
                <BrowserFrame url="app.bakerycms.com/reports">
                  <AnalyticsMockup />
                </BrowserFrame>
              </ScrollReveal>
            </div>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 11 — Why Choose Bakery CMS                           */}
        {/* ============================================================ */}
        <Section className="bg-background">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Why Bakery CMS"
                title="Built for bakeries that mean business"
                description="Every detail is engineered for performance, growth, and a product experience your customers will remember."
              />
            </ScrollReveal>
            <StaggerReveal className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {whyChoose.map((w) => (
                <div
                  key={w.title}
                  className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4A373]/60 hover:shadow-md"
                >
                  <IconTile icon={w.icon} className="size-11 rounded-xl [&_svg]:size-5" />
                  <div className="flex flex-col gap-1 pt-0.5">
                    <h3 className="font-heading text-base font-semibold">{w.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{w.description}</p>
                  </div>
                </div>
              ))}
            </StaggerReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 12 — Technology                                      */}
        {/* ============================================================ */}
        <Section className="bg-white !py-16">
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
        {/* SECTION 13 — Roadmap                                         */}
        {/* ============================================================ */}
        <Section id="roadmap" className="bg-background">
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow="Roadmap"
                title="A platform that keeps getting better"
                description="Here's what's live today, and what's coming next for your bakery."
              />
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <div className="relative mx-auto mt-14 max-w-2xl">
                <span aria-hidden className="absolute bottom-6 left-5 top-6 w-px bg-border" />
                <ol className="space-y-4">
                  {roadmap.map((item) => (
                    <li key={item.title} className="relative flex gap-5 pl-14">
                      <span className="absolute left-0 top-4 flex size-10 items-center justify-center rounded-full border border-border bg-card text-[#7A4D2B] shadow-sm">
                        <item.icon className="size-5" />
                      </span>
                      <div className="flex flex-1 flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-heading text-base font-semibold">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <span
                          className={
                            "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold " +
                            (item.status === "Available"
                              ? "bg-[#E9F1E4] text-[#4f8a45]"
                              : "bg-[#F6ECDF] text-[#8a6a45]")
                          }
                        >
                          <span
                            className={
                              "size-1.5 rounded-full " +
                              (item.status === "Available" ? "bg-[#4f8a45]" : "bg-[#c99a5b]")
                            }
                          />
                          {item.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </ScrollReveal>
          </Container>
        </Section>

        {/* ============================================================ */}
        {/* SECTION 14 — FAQ                                             */}
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
        {/* SECTION 15 — Call To Action                                  */}
        {/* ============================================================ */}
        <Section className="bg-background">
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
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-[#F0DFC9]">
                    <SparklesIcon className="size-3.5" />
                    Ready when you are
                  </span>
                  <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white md:text-[2.75rem] md:leading-[1.1]">
                    Ready to build your bakery business?
                  </h2>
                  <p className="max-w-xl text-pretty text-[15px] leading-relaxed text-[#EADFD1] md:text-lg">
                    Explore the live admin and storefront demo, then launch your own modern
                    bakery platform in minutes.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <LinkButton
                      href={ctaLinks.admin}
                      variant="secondary"
                      size="lg"
                      className="border-transparent bg-white text-[#7A4D2B] hover:bg-[#F6EEE3]"
                    >
                      Launch Admin
                      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </LinkButton>
                    <LinkButton
                      href={ctaLinks.store}
                      variant="ghost"
                      size="lg"
                      className="border border-white/25 text-white hover:bg-white/10"
                    >
                      Explore Demo
                    </LinkButton>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </Container>
        </Section>
      </main>

      {/* ============================================================ */}
      {/* SECTION 16 — Footer                                          */}
      {/* ============================================================ */}
      <footer className="bg-[#241810] text-[#E7DDD1]">
        <Container className="py-16">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="flex flex-col gap-4">
              <Logo tone="invert" />
              <p className="max-w-xs text-sm leading-relaxed text-[#B7A895]">
                The complete platform to manage, sell, and grow your bakery — website, orders,
                payments, and more, from one modern dashboard.
              </p>
              <div className="mt-2 flex items-center gap-2">
                {[GlobeIcon, MailIcon, MessageCircleIcon, SendIcon].map((Icon, i) => (
                  <span
                    key={i}
                    className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#D8C9B6] transition-colors hover:border-[#D4A373]/60 hover:text-white"
                  >
                    <Icon className="size-4" />
                  </span>
                ))}
              </div>
            </div>

            {footerColumns.map((col) => (
              <div key={col.heading} className="flex flex-col gap-4">
                <p className="text-sm font-semibold text-white">{col.heading}</p>
                <ul className="flex flex-col gap-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.soon ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-[#8f8171]">
                          {link.label}
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#C7B49A]">
                            Soon
                          </span>
                        </span>
                      ) : (
                        <a
                          href={link.href}
                          className="text-sm text-[#B7A895] transition-colors hover:text-white"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-[#8f8171] sm:flex-row">
            <p>© 2026 Bakery CMS. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              Crafted for bakeries, cake shops &amp; custom retail
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
