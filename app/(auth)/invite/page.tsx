import type { Metadata } from "next";
import { AcceptInvitationPage } from "@/features/team/pages/accept-invitation-page";

export const metadata: Metadata = {
  title: "Join the team",
  description: "Accept an invitation to the shop's admin.",
  // An invitation page has nothing for a search engine.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AcceptInvitationPage />;
}
