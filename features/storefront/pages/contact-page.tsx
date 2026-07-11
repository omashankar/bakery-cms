import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/features/storefront/components/contact-form";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import {
  getStorefrontBusinessHours,
  getStorefrontContactInfo,
} from "@/features/storefront/lib/settings";
import { layoutSpacing } from "@/constants/spacing";

interface ContactPageProps {
  defaultSubject?: string;
}

export function ContactPage({ defaultSubject }: ContactPageProps) {
  const contactInfo = getStorefrontContactInfo();
  const businessHours = getStorefrontBusinessHours();
  return (
    <>
      <StorePageHeader
        title="Contact Us"
        description="We would love to help with your next celebration."
        breadcrumbs={[{ label: "Contact" }]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-white p-6 sm:p-8">
              <ContactForm defaultSubject={defaultSubject} />
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-cream-100 p-6">
                <h2 className="font-heading mb-4 text-lg font-semibold">
                  Get in Touch
                </h2>
                <ul className="space-y-4 text-sm text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-bakery-700" />
                    {contactInfo.address}
                  </li>
                  <li className="flex items-center gap-3">
                    <Phone className="size-4 shrink-0 text-bakery-700" />
                    {contactInfo.phone}
                  </li>
                  <li className="flex items-center gap-3">
                    <Mail className="size-4 shrink-0 text-bakery-700" />
                    {contactInfo.email}
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-white p-6">
                <h2 className="font-heading mb-4 text-lg font-semibold">
                  Opening Hours
                </h2>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {businessHours.map((item) => (
                    <li key={item.day} className="flex items-start gap-3">
                      <Clock className="mt-0.5 size-4 shrink-0 text-bakery-700" />
                      <span>
                        <span className="font-medium text-foreground">
                          {item.day}
                        </span>
                        <br />
                        {item.hours}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="aspect-video overflow-hidden rounded-xl border border-border bg-white">
                <iframe
                  title="Bakery location"
                  src={contactInfo.mapEmbedUrl}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
