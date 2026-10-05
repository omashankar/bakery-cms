"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { createInquiryFromForm } from "@/features/inquiries/lib/inquiries-repository";
import type { InquiryType } from "@/types/inquiry";
import { cn } from "@/lib/utils";
import { useBusinessLabels } from "@/hooks/use-business-labels";

interface ContactFormProps {
  className?: string;
  defaultSubject?: string;
  submitLabel?: string;
  inquiryType?: InquiryType;
}

export function ContactForm({
  className,
  defaultSubject = "",
  submitLabel = "Submit Inquiry",
  inquiryType = "contact",
}: ContactFormProps) {
  const labels = useBusinessLabels();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const form = event.currentTarget;
    const data = new FormData(form);

    const { persisted } = await createInquiryFromForm({
      type: inquiryType,
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? "") || undefined,
      subject: String(data.get("subject") ?? "") || undefined,
      message: String(data.get("message") ?? ""),
      eventDate: String(data.get("eventDate") ?? "") || undefined,
      guestCount: data.get("guestCount")
        ? Number(data.get("guestCount"))
        : undefined,
    });

    await new Promise((resolve) => setTimeout(resolve, 400));

    if (!persisted) {
      // The thank-you page promises someone will be in touch. An enquiry that
      // only reached this browser reaches nobody, so the form stays put — with
      // what they typed still in it — rather than sending them away reassured.
      setIsSubmitting(false);
      toast.error("We couldn't send your message", {
        description: "Please check your connection and try again.",
      });
      return;
    }

    router.push(routes.store.thankYou);
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" name="name" placeholder="Your full name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+91" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
        />
      </div>
      {inquiryType === "wedding" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="eventDate">Event Date</Label>
            <Input id="eventDate" name="eventDate" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guestCount">Guest Count</Label>
            <Input id="guestCount" name="guestCount" type="number" min={1} placeholder="150" />
          </div>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          name="subject"
          placeholder={`Order inquiry, custom ${labels.productWord.toLowerCase()}, etc.`}
          defaultValue={defaultSubject}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        {/*
          THE SHARED COMPONENT, NOT A HAND-WRITTEN BOX.

          This was a raw `<textarea>` carrying its own classes, and it had
          drifted from the Inputs above it in five ways. One of them cost
          a customer the rest of their visit: `text-sm` renders at 14px on
          a phone, and iOS Safari zooms the page when a focused field's
          text is under 16px — then leaves it zoomed after the blur. This
          is the last field before Send. The shared component is
          `text-base md:text-sm`: 16px on a phone, 14px on a desktop,
          which is what every other field here already did.

          The other four were quieter: `rounded-xl` against the Inputs'
          `rounded-lg`, `px-3` against `px-2.5`, no placeholder colour,
          and no disabled or `aria-invalid` styling at all — so a
          validation failure on this field would have shown nothing while
          the fields above it turned red.

          `min-h-32` is kept so the box is the size it is today.
        */}
        <Textarea
          id="message"
          name="message"
          required
          placeholder="Tell us about your order or requirement..."
          className="min-h-32"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : submitLabel}
      </Button>
    </form>
  );
}
