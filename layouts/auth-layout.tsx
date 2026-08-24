"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AuthLayoutShellProps {
  children: React.ReactNode;
  /**
   * The shop's name. Empty when the settings read failed — the shell then says
   * nothing about whose panel this is rather than naming the wrong party.
   */
  siteName?: string;
  /**
   * The shop's WORDMARK. Usually the name drawn, so where it exists it replaces
   * the name rather than sitting beside it — the same rule the storefront header
   * and footer follow.
   */
  logo?: string;
  /**
   * The shop's SQUARE icon, for the badge when there is no wordmark. The two are
   * not interchangeable: a 3:1 wordmark in a 48px square is 48x15px.
   */
  favicon?: string;
  className?: string;
}

const ease = [0.22, 1, 0.36, 1] as const;

const brandPoints = [
  "Manage cakes, catalog & inventory",
  "Track orders, customers & inquiries",
  "Build pages, media & storefront content",
];

/**
 * The square badge: the shop's icon if it has one, else its initial.
 *
 * Only rendered when there is no wordmark — a wordmark carries the name and gets
 * its own width instead. The favicon is the one image a shop is guaranteed to
 * have made square, which is why it fits here and the wordmark does not: a 3:1
 * mark in a 48px box is 48x15px.
 *
 * Declared at module level, not inside the shell. A component defined during
 * render is a new type on every render, so React remounts its whole subtree
 * instead of updating it — and eslint's `Cannot create components during render`
 * caught exactly that here.
 */
function BrandBadge({
  icon,
  letter,
  name,
  boxClass,
  letterClass,
}: {
  icon: string;
  letter: string;
  name: string;
  boxClass: string;
  letterClass: string;
}) {
  return (
    <div className={cn(boxClass, icon && "overflow-hidden")}>
      {icon ? (
        // An admin-typed URL on any host, so next/image is not usable here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" title={name} className="size-full object-cover" />
      ) : (
        <span className={letterClass}>{letter}</span>
      )}
    </div>
  );
}

/**
 * Staff auth — one brand plane + one form column.
 * Solid colors only. Left is bakery brand; right stays light.
 */
export function AuthLayoutShell({
  children,
  siteName = "",
  logo = "",
  favicon = "",
  className,
}: AuthLayoutShellProps) {
  const name = siteName.trim();
  const letter = name.charAt(0).toUpperCase();
  const wordmark = logo.trim();
  const icon = favicon.trim();


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
              {/* The wordmark takes the badge's place and the heading's job:
                  it already says the name, and this plane is the widest space
                  on either screen, so it gets a generous height. */}
              {wordmark ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={wordmark}
                  alt={name}
                  className="h-16 w-auto max-w-[320px] object-contain object-left"
                />
              ) : (
                <BrandBadge
                  icon={icon}
                  letter={letter}
                  name={name}
                  boxClass="flex size-12 items-center justify-center rounded-2xl bg-gold-300"
                  letterClass="font-heading text-xl font-bold text-bakery-900"
                />
              )}

              <div className="space-y-4">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-gold-300 uppercase">
                  Staff console
                </p>
                {/* Not printed under a wordmark that already reads it. */}
                {wordmark ? null : (
                  <h1 className="font-heading text-4xl font-bold tracking-tight text-cream-50 xl:text-5xl">
                    {name}
                  </h1>
                )}
                <div className="h-px w-12 bg-gold-300" />
                <p className="text-[15px] leading-relaxed text-cream-200/75">
                  Orders, pages, media and enquiries — one calm place for your team.
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
              {name ? `© ${new Date().getFullYear()} ${name} · ` : ""}Internal staff
              access only
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
            {/* Same rule, smaller: the wordmark replaces the badge AND the
                name, and "Staff console" stays either way — it says what the
                screen is, not whose it is. */}
            {wordmark ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={wordmark}
                  alt={name}
                  className="h-10 w-auto max-w-[200px] object-contain object-left"
                />
                <p className="text-xs text-muted-foreground">Staff console</p>
              </>
            ) : (
              <>
                <BrandBadge
                  icon={icon}
                  letter={letter}
                  name={name}
                  boxClass="flex size-11 items-center justify-center rounded-2xl bg-bakery-900"
                  letterClass="font-heading text-lg font-bold text-gold-300"
                />
                <div>
                  <p className="font-heading text-lg font-bold text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">Staff console</p>
                </div>
              </>
            )}
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
