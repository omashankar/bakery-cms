"use client";

import { Smartphone } from "lucide-react";
import { SettingsPlaceholder } from "./settings-placeholder";

export function SmsSettingsPage() {
  return (
    <SettingsPlaceholder
      title="SMS Notifications"
      description="Send order and payment updates over SMS."
      icon={Smartphone}
      features={[
        "Connect an SMS provider (Twilio, MSG91, etc.)",
        "Order confirmation and delivery SMS templates",
        "OTP / verification messages",
        "Per-event SMS toggles alongside email and WhatsApp",
      ]}
      // This page is an honest "coming soon", so what it points AT has to be
      // honest too. It once said WhatsApp was "already available" when nothing
      // could deliver a message, which is the worst kind of misdirection from
      // here — the reader arrives believing they have found the working one.
      //
      // WhatsApp does send now, via Meta's Cloud API, but only after a shop
      // connects a number and Meta approves the wording. So it is offered as
      // something to set up, not as something that already works.
      note="Email works today — see Settings → Communication. WhatsApp can send order updates too, once you connect a WhatsApp Business number under WhatsApp Templates."
    />
  );
}
