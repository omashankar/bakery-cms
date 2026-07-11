import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "border border-border bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "border border-destructive/40 bg-card text-destructive focus-visible:ring-destructive/20 [a]:hover:bg-destructive/10",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        accent:
          "border-gold-300/80 bg-gold-50 text-bakery-800 dark:border-gold-400/40 dark:bg-gold-900/30 dark:text-gold-200 [a]:hover:bg-gold-100 dark:[a]:hover:bg-gold-900/50",
        gold: "border-gold-300/80 bg-gold-50 text-bakery-800 dark:border-gold-400/40 dark:bg-gold-900/30 dark:text-gold-200 [a]:hover:bg-gold-100 dark:[a]:hover:bg-gold-900/50",
        bakery:
          "bg-bakery-700 text-white dark:bg-bakery-600 dark:text-white [a]:hover:bg-bakery-800 dark:[a]:hover:bg-bakery-500",
        success: "bg-green-100 text-green-800 [a]:hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300",
        warning: "bg-amber-100 text-amber-800 [a]:hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
