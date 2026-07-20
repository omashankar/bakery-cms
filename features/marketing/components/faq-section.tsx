"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "../landing-data";

export function FaqSection() {
  return (
    <Accordion multiple={false} className="mx-auto max-w-3xl gap-3">
      {faqs.map((faq, i) => (
        <AccordionItem
          key={faq.question}
          value={`faq-${i}`}
          className="rounded-2xl border border-border bg-card px-5 shadow-sm transition-colors data-[panel-open]:border-[#D4A373]/50"
        >
          <AccordionTrigger className="gap-4 py-5 text-[15px] font-medium text-foreground hover:no-underline">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="pb-5 text-[14px] leading-relaxed text-muted-foreground">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
