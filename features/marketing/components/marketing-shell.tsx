import type React from "react";

import { Container } from "./section";
import { Logo } from "./logo";
import { SiteHeader } from "./site-header";
import { footerColumns, socialLinks } from "../landing-data";

/**
 * The marketing site’s palette, as CSS custom properties.
 *
 * These pages are NOT the storefront and must not inherit the shop’s own
 * appearance settings — a bakery that themes its store purple should not
 * repaint the page that sells the software. `storefront-light` on the wrapper
 * pins the light scheme for the same reason.
 */
export const brandVars = {
  "--background": "#FAF9F7",
  "--card": "#FFFFFF",
  "--foreground": "#26201B",
  "--primary": "#7A4D2B",
  "--primary-foreground": "#FFFFFF",
  "--secondary": "#F3EEE7",
  "--secondary-foreground": "#7A4D2B",
  "--muted": "#F3EEE7",
  "--muted-foreground": "#776E62",
  "--accent": "#F3EEE7",
  "--accent-foreground": "#7A4D2B",
  "--border": "#ECE6DC",
  "--border-soft": "#ECE6DC",
  "--ring": "#D4A373",
  "--brand-accent": "#D4A373",
} as React.CSSProperties;

/**
 * Header, footer and palette for every page under `/platform`.
 *
 * Lifted out of `landing-page.tsx` when Pricing and Documentation stopped being
 * "Soon" and became real pages: three copies of a footer is three places to
 * forget when a link changes.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="storefront-light min-h-screen bg-background font-sans text-foreground"
      style={brandVars}
    >
      <SiteHeader />

      <main>{children}</main>

      {/* ============================================================ */}
      <footer className="bg-[#241810] text-[#E7DDD1]">
        <Container className="py-16">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="flex flex-col gap-4">
              <Logo tone="invert" />
              <p className="max-w-xs text-sm leading-relaxed text-[#B7A895]">
                The complete platform to manage, sell, and grow your bakery — website, orders,
                payments, and more, from one modern dashboard.
              </p>
              <div className="mt-2 flex items-center gap-2">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#D8C9B6] outline-none transition-colors hover:border-[#D4A373]/60 hover:text-white focus-visible:ring-2 focus-visible:ring-[#D4A373]/60"
                  >
                    <social.icon className="size-4" aria-hidden />
                  </a>
                ))}
              </div>
            </div>

            {footerColumns.map((col) => (
              <div key={col.heading} className="flex flex-col gap-4">
                <p className="text-sm font-semibold text-white">{col.heading}</p>
                <ul className="flex flex-col gap-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.soon ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-[#8f8171]">
                          {link.label}
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#C7B49A]">
                            Soon
                          </span>
                        </span>
                      ) : link.href ? (
                        <a
                          href={link.href}
                          className="text-sm text-[#B7A895] transition-colors hover:text-white"
                        >
                          {link.label}
                        </a>
                      ) : (
                        /*
                          Listed, but not a link — there is no page of OURS behind it
                          yet, and the shop’s own is the wrong answer. Rendered dimmer
                          and with no hover so it does not invite a click it cannot
                          honour; see the note in `footerColumns`.
                        */
                        <span className="cursor-default text-sm text-[#8f8171]">{link.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-[#8f8171] sm:flex-row">
            <p>© {new Date().getFullYear()} Bakery CMS. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              Crafted for bakeries, cake shops &amp; custom retail
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
