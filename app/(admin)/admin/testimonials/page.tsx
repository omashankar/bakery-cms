import type { Metadata } from "next";
import { TestimonialsAdminPage } from "@/apps/admin/testimonials/components/testimonials-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { readContentForAdmin } from "@/features/content/server/content.initial";
import type { Testimonial } from "@/types/content";

export const metadata: Metadata = {
  title: "Testimonials",
  description: "Manage customer reviews and ratings.",
};

/** Every testimonial and the version a save must carry, read with the page. */
export default async function Page() {
  const initial = await whenAdmin(async () =>
    JSON.parse(JSON.stringify(await readContentForAdmin<Testimonial[]>("testimonials"))),
  );
  return <TestimonialsAdminPage initial={initial} />;
}
