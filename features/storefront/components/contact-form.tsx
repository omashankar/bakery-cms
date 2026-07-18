"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { createInquiryFromForm } from "@/features/inquiries/lib/inquiries-repository";
import type { InquiryType } from "@/types/inquiry";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const form = event.currentTarget;
    const data = new FormData(form);

    createInquiryFromForm({
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
          placeholder="Order inquiry, custom cake, etc."
          defaultValue={defaultSubject}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          required
          placeholder="Tell us about your order or requirement..."
          className="min-h-32 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : submitLabel}
      </Button>
    </form>
  );
}
