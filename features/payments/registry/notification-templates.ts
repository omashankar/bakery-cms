/**
 * Payment notification catalogue (frontend only).
 *
 * Defines every payment-related notification for customers and admins, with a
 * sample template and default delivery channels. Actual sending happens in the
 * backend later — this drives the management UI + preferences.
 */

export type NotifAudience = "customer" | "admin";
export type NotifChannel = "in_app" | "email" | "sms";

export type NotifIcon =
  | "CheckCircle2"
  | "XCircle"
  | "RotateCcw"
  | "Banknote"
  | "FileText"
  | "CreditCard"
  | "ServerCrash";

export interface NotificationTemplate {
  id: string;
  audience: NotifAudience;
  event: string;
  title: string;
  /** Sample body with {placeholders}. */
  message: string;
  channels: NotifChannel[];
  icon: NotifIcon;
}

export const CHANNEL_LABELS: Record<NotifChannel, string> = {
  in_app: "In-app",
  email: "Email",
  sms: "SMS",
};

export const PAYMENT_NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  // ── Customer ──────────────────────────────────────────────
  {
    id: "cust_payment_success",
    audience: "customer",
    event: "Payment Success",
    title: "Payment successful 🎉",
    message: "Your payment of {amount} for order {order} is confirmed. We're preparing your cakes!",
    channels: ["in_app", "email", "sms"],
    icon: "CheckCircle2",
  },
  {
    id: "cust_payment_failed",
    audience: "customer",
    event: "Payment Failed",
    title: "Payment couldn't be completed",
    message: "We couldn't process your payment for order {order}. Please retry or choose another method.",
    channels: ["in_app", "email"],
    icon: "XCircle",
  },
  {
    id: "cust_refund_initiated",
    audience: "customer",
    event: "Refund Initiated",
    title: "Your refund is on the way",
    message: "A refund of {amount} for order {order} has been initiated and will reflect in 5–7 days.",
    channels: ["in_app", "email"],
    icon: "RotateCcw",
  },
  {
    id: "cust_refund_completed",
    audience: "customer",
    event: "Refund Completed",
    title: "Refund completed",
    message: "Your refund of {amount} for order {order} has been processed successfully.",
    channels: ["in_app", "email", "sms"],
    icon: "Banknote",
  },
  {
    id: "cust_invoice_generated",
    audience: "customer",
    event: "Invoice Generated",
    title: "Your invoice is ready",
    message: "The tax invoice for order {order} is ready to download.",
    channels: ["in_app", "email"],
    icon: "FileText",
  },

  // ── Admin ─────────────────────────────────────────────────
  {
    id: "admin_payment_received",
    audience: "admin",
    event: "Payment Received",
    title: "Payment received",
    message: "{amount} received for order {order} via {gateway}.",
    channels: ["in_app", "email"],
    icon: "CreditCard",
  },
  {
    id: "admin_payment_failed",
    audience: "admin",
    event: "Payment Failed",
    title: "Payment failed",
    message: "Payment failed for order {order} ({amount}). Customer may retry.",
    channels: ["in_app"],
    icon: "XCircle",
  },
  {
    id: "admin_refund_request",
    audience: "admin",
    event: "Refund Request",
    title: "New refund request",
    message: "{customer} requested a refund of {amount} for order {order}.",
    channels: ["in_app", "email"],
    icon: "RotateCcw",
  },
  {
    id: "admin_gateway_error",
    audience: "admin",
    event: "Gateway Error",
    title: "Gateway error",
    message: "{gateway} reported an error while processing a payment. Check the gateway status.",
    channels: ["in_app", "email"],
    icon: "ServerCrash",
  },
  {
    id: "admin_cod_confirmation",
    audience: "admin",
    event: "COD Confirmation",
    title: "COD collected",
    message: "{amount} collected on delivery for order {order}.",
    channels: ["in_app"],
    icon: "Banknote",
  },
];
