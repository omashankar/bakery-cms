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
      // WhatsApp is NOT available in the sense this sentence implied — its
      // screen edits templates that nothing can deliver. Sending a reader
      // from an honest "coming soon" page towards another unbuilt channel,
      // described as available, is the worst kind of misdirection: they
      // arrive believing they have found the working one.
      note="Email is the channel that works today — see Settings → Communication. WhatsApp templates can be drafted there too, but have no provider connected yet."
    />
  );
}
