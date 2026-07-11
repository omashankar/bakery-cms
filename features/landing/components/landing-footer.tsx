import Link from "next/link";
import {
  Clock,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Video,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import {
  getStorefrontBrandInfo,
  getStorefrontBusinessHours,
  getStorefrontContactInfo,
  getStorefrontSocialLinks,
} from "@/features/storefront/lib/settings";
import { getStorefrontFooterSettings } from "@/features/storefront/lib/site-layout";
import { cn } from "@/lib/utils";

const socialIconMap = {
  Instagram: Share2,
  Facebook: Globe,
  WhatsApp: MessageCircle,
  YouTube: Video,
} as const;

export function LandingFooter() {
  const brandInfo = getStorefrontBrandInfo();
  const contactInfo = getStorefrontContactInfo();
  const businessHours = getStorefrontBusinessHours();
  const socialLinks = getStorefrontSocialLinks();
  const footerSettings = getStorefrontFooterSettings();

  return (
    <footer className="border-t border-border surface-cream">
      <div className={cn(layoutSpacing.container, "py-14")}>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <Link href={routes.store.home} className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-bakery-700">
                <span className="font-heading text-sm font-bold text-white">M</span>
              </div>
              <span className="font-heading text-lg font-bold">{brandInfo.name}</span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {brandInfo.description}
            </p>
            {footerSettings.showSocial ? (
              <div className="flex items-center gap-2">
                {socialLinks.map((social) => {
                  const Icon =
                    socialIconMap[social.platform as keyof typeof socialIconMap] ??
                    Share2;
                  return (
                    <a
                      key={social.platform}
                      href={social.href}
                      aria-label={social.label}
                      className="flex size-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition-premium hover:border-bakery-300 hover:text-bakery-700"
                    >
                      <Icon className="size-4" />
                    </a>
                  );
                })}
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
                {businessHours.map((item) => (
                  <li key={item.day} className="flex items-start gap-2">
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

        {footerSettings.showMap ? (
          <div className="mt-10 aspect-video overflow-hidden rounded-xl border border-border bg-white sm:aspect-[21/9]">
            <iframe
              title="Bakery location map"
              src={contactInfo.mapEmbedUrl}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        ) : null}

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
