"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, HelpCircle, Mail, MessageCircle, Phone, Search } from "lucide-react";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/constants/routes";
import { formatFaqCategory } from "@/features/content/lib/faq-utils";
import { getStorefrontFaqs } from "@/features/storefront/lib/content";
import type { FaqCategory } from "@/types/content";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

const faqCategories: Array<{ label: string; value: "all" | FaqCategory }> = [
  { label: "All", value: "all" },
  { label: "General", value: "general" },
  { label: "Orders", value: "orders" },
  { label: "Wedding", value: "wedding" },
  { label: "Delivery", value: "delivery" },
];

export function FaqPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof faqCategories)[number]["value"]>("all");

  const categoryFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const items =
      category === "all" ? getStorefrontFaqs() : getStorefrontFaqs(category);
    return items.filter((faq) => {
      if (!query) return true;
      return (
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query)
      );
    });
  }, [search, category]);

  return (
    <>
      <StorePageHeader
        title="Frequently Asked Questions"
        description="Everything you need to know about ordering, delivery, and our cakes."
        breadcrumbs={[{ label: "FAQ" }]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          <div className="grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:gap-12">
            {/* FAQ list */}
            <ScrollReveal>
              <div className="relative mb-6">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-xl pl-9"
                  placeholder="Search FAQ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="mb-8 flex flex-wrap gap-2">
                {faqCategories.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(item.value)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-medium transition-premium",
                      category === item.value
                        ? "border-bakery-700 bg-bakery-700 text-white shadow-sm"
                        : "border-border bg-white text-muted-foreground hover:border-bakery-300 hover:text-bakery-700"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {categoryFiltered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
                  <HelpCircle className="mx-auto mb-3 size-8 text-bakery-300" />
                  No matching questions found.
                </div>
              ) : (
                <Accordion
                  // The accordion is uncontrolled, so its defaultValue is only
                  // read once. Searching or switching category produces a
                  // different first result, and changing defaultValue in place
                  // warns. Keying on that first id starts a fresh accordion for
                  // a genuinely new list — which also opens the top match,
                  // rather than leaving every filtered result collapsed.
                  key={categoryFiltered[0]?.id ?? "none"}
                  defaultValue={[categoryFiltered[0]?.id ?? "1"]}
                  className="space-y-3"
                >
                  {categoryFiltered.map((faq) => (
                    <AccordionItem
                      key={faq.id}
                      value={faq.id}
                      className="overflow-hidden rounded-2xl border border-border bg-white transition-colors hover:border-bakery-300"
                    >
                      <AccordionTrigger className="px-5 py-4 text-left font-heading font-semibold hover:no-underline">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-4 leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}

              {category !== "all" ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Showing {formatFaqCategory(category)} questions
                </p>
              ) : null}
            </ScrollReveal>

            {/* Help sidebar */}
            <ScrollReveal delay={120} className="lg:sticky lg:top-24 lg:self-start">
              <aside className="rounded-3xl border border-border bg-cream-100 p-6 sm:p-8">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-bakery-700 shadow-sm">
                  <MessageCircle className="size-6" />
                </span>
                <h2 className="mt-5 font-heading text-xl font-bold sm:text-2xl">
                  Still have questions?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Can&apos;t find what you&apos;re looking for? Our friendly team is happy to help
                  with orders, custom designs, and delivery.
                </p>

                <div className="mt-6 space-y-3">
                  <a
                    href="tel:+9118001234567"
                    className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3.5 transition-all hover:border-bakery-300 hover:shadow-sm"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                      <Phone className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">Call us</span>
                      <span className="block text-xs text-muted-foreground">+91 1800-123-4567</span>
                    </span>
                  </a>
                  <a
                    href="mailto:hello@monginis.com"
                    className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3.5 transition-all hover:border-bakery-300 hover:shadow-sm"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                      <Mail className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">Email us</span>
                      <span className="block text-xs text-muted-foreground">hello@monginis.com</span>
                    </span>
                  </a>
                </div>

                <Button
                  className="mt-6 w-full rounded-xl"
                  render={<Link href={routes.store.contact} />}
                >
                  Contact Support
                  <ArrowRight className="size-4" />
                </Button>
              </aside>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </>
  );
}
