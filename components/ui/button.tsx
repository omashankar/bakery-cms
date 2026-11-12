import { cloneElement, isValidElement } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // A disabled filled button keeps readable ink: at 50% opacity the
        // white label on a pale brand fill could not be read ("Save changes"
        // on every settings page before anything is edited).
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-muted aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
        accent:
          "border border-gold-300 bg-background text-foreground hover:bg-muted dark:border-gold-400/50",
        bakery:
          "bg-bakery-700 text-white hover:bg-bakery-800 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 dark:bg-bakery-600 dark:hover:bg-bakery-500",
        cream:
          "border border-border bg-muted text-foreground hover:bg-secondary",
        gold:
          "border border-gold-300 bg-background text-foreground hover:bg-muted dark:border-gold-400/50",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const render = (props as { render?: unknown }).render
  const usesCustomRender = "render" in props && Boolean(render)

  /*
    A LINK DRESSED AS A BUTTON IS STILL A LINK.

    \`render={<Link href=… />}\` went through Base UI's Button, which gives any
    element that is not a <button> \`role="button"\`. So the header's Wishlist
    and Cart, and some ninety other link-buttons across the shop and the
    admin, were <a href> elements announced as buttons: a screen reader said
    "Wishlist, button", the rotor's list of links left them out, and the
    shop's own browser checks could not find them as links. Anything with an
    \`href\` is rendered as itself, with the button's look and nothing else.
  */
  if (
    isValidElement<{ href?: unknown; className?: string }>(render) &&
    render.props.href !== undefined
  ) {
    const { render: _render, nativeButton: _native, ...rest } = props as typeof props & {
      nativeButton?: boolean
    }
    return cloneElement(render, {
      "data-slot": "button",
      ...rest,
      className: cn(buttonVariants({ variant, size, className }), render.props.className),
    } as Record<string, unknown>)
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={usesCustomRender ? false : undefined}
      {...props}
    />
  )
}

export { Button, buttonVariants }
