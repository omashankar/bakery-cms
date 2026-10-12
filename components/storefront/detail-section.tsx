/**
 * One block of product information, folded the way the shop's reference
 * (Flipkart's phone page) folds it: the heading with a one-line summary under
 * it and a chevron at the end; tap to open.
 *
 * The heading is what a tab label used to be. A section renders only where the
 * shop has filled the field, so an empty one disappears rather than printing
 * somebody else's product back at the customer.
 *
 * A native `<details>`, not a stateful accordion: opening it costs no
 * JavaScript, and a closed section's content is still in the HTML — a crawler
 * reads it, and the browser's find-in-page opens the section it matches in.
 * Tabs that rendered only the open panel were the reason this component
 * exists; folding must not bring that back.
 *
 * No `"use client"`: it is markup and nothing else, so a server component can
 * render it too.
 */
import { ChevronDown } from "lucide-react";
import { storefrontHeading } from "@/constants/typography";

export function DetailSection({
  title,
  id,
  summary,
  children,
}: {
  title: string;
  id?: string;
  /** The grey line under a CLOSED heading — "No questions yet", "4.1★ …". */
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border">
      <details className="group">
        {/*
          A grid, not a wrapper: a <summary> may hold a heading and phrasing
          content, and nothing else — no <div> around the two lines.
        */}
        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-4 [&::-webkit-details-marker]:hidden">
          <h2 className={storefrontHeading.card}>{title}</h2>
          <span
            aria-hidden="true"
            className="row-span-2 flex size-8 items-center justify-center rounded-md bg-muted text-foreground"
          >
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </span>
          {summary ? (
            <span className="mt-0.5 text-sm text-muted-foreground group-open:hidden">{summary}</span>
          ) : null}
        </summary>
        <div className="pb-6">{children}</div>
      </details>
    </section>
  );
}
