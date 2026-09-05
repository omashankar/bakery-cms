"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

/**
 * One value, dragged.
 *
 * The kit had no slider, and the first thing that wanted one — fitting a
 * photograph inside the frame it will be printed in — wants eight. A bare
 * `<input type="range">` would have been quicker and would also have been a
 * second control system: this repo's inputs are Base UI with the shop's own
 * tokens on them, and a browser-default range is neither.
 *
 * Single-thumb on purpose. Base UI's root takes an array for a range slider,
 * and every caller so far wants a number; the two-thumb case can widen this
 * when something actually needs it, rather than being carried untested.
 */
function Slider({
  className,
  ...props
}: Omit<SliderPrimitive.Root.Props<number>, "value" | "defaultValue" | "onValueChange"> & {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
}) {
  /**
   * The label belongs to the THUMB, and to the thumb ONLY.
   *
   * Base UI's root renders `role="group"`, so a label left in the spread names
   * the group as well as the range input inside it — and a screen reader then
   * reads "Zoom, group" followed by "Zoom, slider" for every one of eight
   * controls in the same dialog. Taking it out of `rest` is what makes the
   * name exist once.
   */
  const {
    value,
    defaultValue,
    onValueChange,
    "aria-label": label,
    ...rest
  } = props

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next)}
      className={cn("w-full select-none", className)}
      {...rest}
    >
      {/*
        The control is the hit area, and it is far taller than the track it
        draws. A 4px line is a fair thing to look at and an unfair thing to aim
        at — and this one lives inside a scrolling dialog, so a thumb-press
        that misses vertically does not merely miss, it starts scrolling the
        page out from under the finger.
      */}
      <SliderPrimitive.Control className="flex min-h-10 w-full touch-none items-center py-3">
        <SliderPrimitive.Track className="h-1 w-full rounded-full bg-muted">
          <SliderPrimitive.Indicator className="rounded-full bg-primary" />
          {/*
            `has-[:focus-visible]`, not `focus-visible`.

            Base UI's thumb is a div wrapping the real `<input type="range">`,
            and the input is the thing that takes focus — clipped to nothing,
            so its own ring is invisible. A `focus-visible:` class on the div
            never matches, and a keyboard customer tabs through eight sliders
            with no idea where they are.
          */}
          <SliderPrimitive.Thumb
            getAriaLabel={label ? () => label : undefined}
            className="size-5 rounded-full border-2 border-primary bg-background shadow-sm outline-none has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 data-dragging:scale-110 data-disabled:opacity-50"
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
