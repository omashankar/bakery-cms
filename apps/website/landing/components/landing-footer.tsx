import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SocialMark } from "@/components/shared/social-mark";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import type { StorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";
import { cn } from "@/lib/utils";

interface LandingFooterProps {
  chrome: StorefrontChrome;
}

export function LandingFooter({ chrome }: LandingFooterProps) {
  // Read on the server from MongoDB (see StorefrontChrome) — the footer now
  // renders the admin's real brand, contact, hours, social + columns in the HTML.
  const brandInfo = chrome.brand;
  const contactInfo = chrome.contact;
  const businessHours = chrome.businessHours;
  const socialLinks = chrome.socialLinks;
  const footerSettings = chrome.footer;

  return (
    <footer className="border-t border-border surface-cream">
      <div className={cn(layoutSpacing.container, "py-14")}>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <Link href={routes.store.home} className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-bakery-700">
                <span className="font-heading text-sm font-bold text-white">
                  {brandInfo.name.charAt(0) || "M"}
                </span>
              </div>
              <span className="font-heading text-lg font-bold">{brandInfo.name}</span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {brandInfo.description}
            </p>
            {/* No row at all when there is nothing to show. An admin who turns
                every profile off means "we are not on social", and the row used
                to fall back to the demo accounts. */}
            {footerSettings.showSocial && socialLinks.length > 0 ? (
              <div className="flex items-center gap-2">
                {socialLinks.map((social, index) => (
                  <a
                    // Index, not the platform: two profiles on the same platform
                    // is ordinary (a shop and its café), and keying on the name
                    // collided and dropped one of them.
                    key={index}
                    href={social.href}
                    aria-label={social.label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex size-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition-premium hover:border-bakery-300 hover:text-bakery-700"
                  >
                    <SocialMark platform={social.platform} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {footerSettings.columns.map((column) => (
            <div key={column.id} className="space-y-4 lg:col-span-2">
              <h4 className="text-sm font-semibold text-foreground">{column.title}</h4>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-bakery-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {footerSettings.showContact ? (
            <div className="space-y-4 lg:col-span-2">
              <h4 className="text-sm font-semibold text-foreground">Contact</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-bakery-700" />
                  {contactInfo.address}
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0 text-bakery-700" />
                  {contactInfo.phone}
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="size-4 shrink-0 text-bakery-700" />
                  {contactInfo.email}
                </li>
              </ul>
            </div>
          ) : null}

          {footerSettings.showHours ? (
            <div className="space-y-4 lg:col-span-2">
              <h4 className="text-sm font-semibold text-foreground">Opening Hours</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {businessHours.map((item, index) => (
                  // Index, not the day: these rows are admin-typed, and two rows
                  // named the same thing collided as React keys and dropped one
                  // of them from the footer.
                  <li key={index} className="flex items-start gap-2">
                    <Clock className="mt-0.5 size-4 shrink-0 text-bakery-700" />
                    <span>
                      <span className="font-medium text-foreground">{item.day}</span>
                      <br />
                      {item.hours}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Location map intentionally omitted here — it lives on the Contact page. */}

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {brandInfo.name}. {footerSettings.copyrightSuffix}
          </p>
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <Link href={routes.home} className="text-bakery-700 hover:underline">
              Bakery CMS
            </Link>
            {" · "}
            <Link href={routes.auth.login} className="text-bakery-700 hover:underline">
              Admin Login
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
