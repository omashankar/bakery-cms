"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createInquiryRequest } from "@/features/inquiries/lib/inquiries-api";
import type { Inquiry } from "@/types/inquiry";

/**
 * Ask the shop something about this product.
 *
 * It files an ENQUIRY — the same record the contact and wedding forms create,
 * landing in the same admin queue with the same notifications. A second table
 * for questions would mean a second inbox the shop has to remember to read, and
 * the one thing worse than no Q&A is a Q&A nobody answers.
 *
 * Nothing it creates is public. The question appears on the page only once the
 * shop has written an answer, which is the moderation step — otherwise this
 * would publish a stranger's words, unread, under the shop's name.
 */
export function ProductQuestionForm({
  productSlug,
  productName,
  onAsked,
}: {
  productSlug: string;
  productName: string;
  onAsked?: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !question.trim()) return;

    setSending(true);
    const created = await createInquiryRequest({
      type: "product",
      name: name.trim(),
      email: email.trim(),
      subject: `Question about ${productName}`,
      message: question.trim(),
      productSlug,
    } as Inquiry);
    setSending(false);

    if (!created) {
      toast.error("Could not send your question. Please try again.");
      return;
    }

    setQuestion("");
    // Says what will actually happen. "Posted" would be false: nothing appears
    // until somebody at the shop answers it.
    toast.success("Question sent", {
      description: "The shop will reply to you by email.",
    });
    onAsked?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-white p-4">
      <p className="text-sm font-medium">Ask about this {"—"} the shop replies by email</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="question-name">Your name</Label>
          <Input
            id="question-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="question-email">Email</Label>
          <Input
            id="question-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="question-body">Your question</Label>
        <Textarea
          id="question-body"
          rows={3}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          required
        />
      </div>
      <Button type="submit" variant="outline" disabled={sending}>
        {sending ? "Sending…" : "Send question"}
      </Button>
    </form>
  );
}
