import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Questions and answers, as the browser's own disclosure widget.
 *
 * These were the accordion primitive, which measures every panel to animate
 * its height. A CPU profile of /store/faq on a throttled phone put 1.2s of the
 * page load inside it, plus 0.9s of garbage collection behind it — the whole
 * of that page's blocking time, for a list that opens and closes.
 *
 * `<details>` needs no JavaScript at all: it is open in the HTML the server
 * sends (so the first answer paints with the page, and a crawler reads every
 * answer), it is keyboard- and screen-reader-operable as built, and the shared
 * `name` makes opening one close the others in browsers that support it —
 * older ones simply let several stay open.
 */

export interface FaqListItem {
  id: string;
  question: string;
  answer: string;
}

interface FaqListProps {
  items: FaqListItem[];
  /** Groups the items so only one is open at a time. Unique per list on a page. */
  name: string;
  /** How many of the first items start open. */
  openFirst?: number;
  className?: string;
  itemClassName?: string;
  questionClassName?: string;
  answerClassName?: string;
  /** The heading level the question sits at in the page outline. */
  headingLevel?: 2 | 3 | 4;
}

export function FaqList({
  items,
  name,
  openFirst = 1,
  className,
  itemClassName,
  questionClassName,
  answerClassName,
  headingLevel = 3,
}: FaqListProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cn("flex w-full flex-col", className)}>
      {items.map((item, index) => (
        <details
          key={item.id}
          name={name}
          open={index < openFirst}
          className={cn("group", itemClassName)}
        >
          <summary
            className={cn(
              "flex cursor-pointer list-none items-start justify-between gap-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden",
              questionClassName,
            )}
          >
            <Heading className="m-0 font-[inherit] text-[length:inherit] leading-[inherit]">
              {item.question}
            </Heading>
            <ChevronDown
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className={cn("text-sm", answerClassName)}>{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
