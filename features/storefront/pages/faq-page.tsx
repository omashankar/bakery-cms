"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { formatFaqCategory } from "@/features/admin/faq";
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
          <div className="mx-auto max-w-3xl">
            <div className="relative mb-6">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
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
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-premium",
                    category === item.value
                      ? "border-bakery-700 bg-bakery-700 text-white"
                      : "border-border bg-white text-muted-foreground hover:border-bakery-300"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {categoryFiltered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
                No matching questions found.
              </div>
            ) : (
              <Accordion
                defaultValue={[categoryFiltered[0]?.id ?? "1"]}
                className="rounded-xl border border-border bg-white px-2"
              >
                {categoryFiltered.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger className="px-4 text-left font-medium hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}

            {category !== "all" ? (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Showing {formatFaqCategory(category)} questions
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
