import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/shared/contact-form";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import {
  getStorefrontBusinessHours,
  getStorefrontContactInfo,
} from "@/apps/website/lib/settings";
import type { StorefrontContact } from "@/apps/website/lib/storefront-contact.server";
import { layoutSpacing } from "@/constants/spacing";

interface ContactPageProps {
  defaultSubject?: string;
  /** Contact details read from MongoDB on the server. Falls back to the client
   *  settings repo only if a caller omits it. */
  contact?: StorefrontContact;
}

export function ContactPage({ defaultSubject, contact }: ContactPageProps) {
  const resolved: StorefrontContact = contact ?? {
    ...getStorefrontContactInfo(),
    businessHours: getStorefrontBusinessHours(),
  };
  const contactInfo = resolved;
  const businessHours = resolved.businessHours;
  return (
    <>
      <StorePageHeader
        title="Contact Us"
        description="We would love to help with your next celebration."
        breadcrumbs={[{ label: "Contact" }]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          <div className="grid items-start gap-8 lg:grid-cols-[1.35fr_1fr]">
            {/* Form */}
            <ScrollReveal className="rounded-2xl border border-border bg-white p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold sm:text-2xl">Send us a message</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Fill in the details below and our team will get back to you within 24 hours.
              </p>
              <div className="mt-6">
                <ContactForm defaultSubject={defaultSubject} />
              </div>
            </ScrollReveal>

            {/* Info + map */}
            <ScrollReveal delay={120} className="space-y-6">
              <div className="rounded-2xl border border-border bg-cream-100 p-6 sm:p-7">
                <h2 className="font-heading text-lg font-bold">Get in Touch</h2>
                <ul className="mt-5 space-y-3">
                  <li className="flex items-start gap-3.5 rounded-xl border border-border bg-white p-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                      <MapPin className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">Visit us</span>
                      <span className="block text-sm text-muted-foreground">{contactInfo.address}</span>
                    </span>
                  </li>
                  <li>
                    <a
                      href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
                      className="flex items-center gap-3.5 rounded-xl border border-border bg-white p-3.5 transition-all hover:border-bakery-300 hover:shadow-sm"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                        <Phone className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-foreground">Call us</span>
                        <span className="block text-sm text-muted-foreground">{contactInfo.phone}</span>
                      </span>
                    </a>
                  </li>
                  <li>
                    <a
                      href={`mailto:${contactInfo.email}`}
                      className="flex items-center gap-3.5 rounded-xl border border-border bg-white p-3.5 transition-all hover:border-bakery-300 hover:shadow-sm"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                        <Mail className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-foreground">Email us</span>
                        <span className="block text-sm text-muted-foreground">{contactInfo.email}</span>
                      </span>
                    </a>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-white p-6 sm:p-7">
                <h2 className="font-heading text-lg font-bold">Opening Hours</h2>
                <ul className="mt-5 space-y-3 text-sm">
                  {businessHours.map((item, index) => (
                    <li
                      // Index, not the day: these rows are admin-typed, and two
                      // rows named the same thing (or a blank one) collided as
                      // React keys and dropped a row from the rendered list.
                      key={index}
                      className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <span className="flex items-center gap-2.5 font-medium text-foreground">
                        <Clock className="size-4 shrink-0 text-bakery-700" />
                        {item.day}
                      </span>
                      <span className="text-muted-foreground">{item.hours}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>

          {/* Map — full-width band so both columns stay balanced. Rendered only
              when there is a map: an admin who clears the field means "no map",
              and the band used to fall back to the demo pin, advertising
              somebody else's address as the shop's. */}
          {contactInfo.mapEmbedUrl ? (
            <ScrollReveal className="mt-8 h-[280px] overflow-hidden rounded-2xl border border-border bg-cream-100 sm:h-[360px]">
              <iframe
                title="Bakery location"
                src={contactInfo.mapEmbedUrl}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                // The accepted host set is deliberately "any https", so an
                // admin can embed OpenStreetMap or Mapbox rather than only
                // Google. That also means the framed page is not trusted:
                // without a sandbox it could navigate the TOP window, and every
                // visitor to the contact page follows it wherever it goes.
                // `allow-top-navigation` is the permission being withheld;
                // scripts, same-origin and popups are what a map needs to work.
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
                allowFullScreen
              />
            </ScrollReveal>
          ) : null}
        </div>
      </section>
    </>
  );
}
