"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AuthLayoutShellProps {
  children: React.ReactNode;
  className?: string;
}

const ease = [0.22, 1, 0.36, 1] as const;

const brandPoints = [
  "Manage cakes, catalog & inventory",
  "Track orders, customers & inquiries",
  "Build pages, media & storefront content",
];

/**
 * Staff auth — one brand plane + one form column.
 * Solid colors only. Left is bakery brand; right stays light.
 */
export function AuthLayoutShell({ children, className }: AuthLayoutShellProps) {
  return (
    <div className={cn("min-h-dvh bg-cream-100 text-foreground", className)}>
      <div className="grid min-h-dvh lg:grid-cols-2">
        {/* Brand plane */}
        <aside className="relative hidden bg-bakery-900 lg:flex">
          <div className="absolute inset-y-0 right-0 w-px bg-gold-300/40" aria-hidden />
          <div className="flex w-full flex-col justify-center px-10 py-14 xl:px-16">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease }}
              className="max-w-md space-y-8"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gold-300">
                <span className="font-heading text-xl font-bold text-bakery-900">B</span>
              </div>

              <div className="space-y-4">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-gold-300 uppercase">
                  Staff console
                </p>
                <h1 className="font-heading text-4xl font-bold tracking-tight text-cream-50 xl:text-5xl">
                  Bakery CMS
                </h1>
                <div className="h-px w-12 bg-gold-300" />
                <p className="text-[15px] leading-relaxed text-cream-200/75">
                  Cakes, pages, media, and inquiries — one calm place for your bakery team.
                </p>
              </div>

              <ul className="space-y-3 border-t border-cream-50/10 pt-6">
                {brandPoints.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-3 text-[14px] leading-relaxed text-cream-200/80"
                  >
                    <span
                      className="mt-[7px] size-1.5 shrink-0 rounded-full bg-gold-300"
                      aria-hidden
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-10 py-8 xl:px-16">
            <p className="text-[12px] text-cream-200/45">
              © 2026 Bakery CMS · Internal staff access only
            </p>
          </div>
        </aside>

        {/* Form column */}
        <main className="relative flex flex-col justify-center px-5 py-12 sm:px-10 lg:px-14 xl:px-20">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="mb-10 flex items-center gap-3 lg:hidden"
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-bakery-900">
              <span className="font-heading text-lg font-bold text-gold-300">B</span>
            </div>
            <div>
              <p className="font-heading text-lg font-bold text-foreground">Bakery CMS</p>
              <p className="text-xs text-muted-foreground">Staff console</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease }}
            className="mx-auto w-full max-w-[420px]"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
