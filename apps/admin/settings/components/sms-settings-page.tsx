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
      note="Email and WhatsApp templates are already available in Settings → Communication."
    />
  );
}
