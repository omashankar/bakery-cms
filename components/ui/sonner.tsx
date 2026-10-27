"use client"

import { useTheme } from "@/components/providers/theme-provider"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * One card for every message, coloured by what it says.
 *
 * Every toast was the same white box — "Signed in" and "Payment failed"
 * looked alike. The colours, the accent edge and the icon disc are in
 * globals.css (`[data-sonner-toast][data-type=…]`), keyed on the type sonner
 * already stamps on each toast, so `toast.success` / `.error` / `.warning` /
 * `.info` callers change nothing.
 */
const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { resolvedTheme = "light" } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      icons={{
        success: <CircleCheckIcon />,
        info: <InfoIcon />,
        warning: <TriangleAlertIcon />,
        error: <OctagonXIcon />,
        loading: <Loader2Icon className="animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "380px",
        } as React.CSSProperties
      }
      {...props}
      // Merged, not replaced: a caller's options used to drop these.
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast: ["cn-toast", toastOptions?.classNames?.toast].filter(Boolean).join(" "),
        },
      }}
    />
  )
}

export { Toaster }
