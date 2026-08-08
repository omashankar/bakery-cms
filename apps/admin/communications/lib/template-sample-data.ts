import {
  contractFor,
  type TemplateChannel,
} from "@/features/communications/lib/template-contract";

export const COMMON_TEMPLATE_VARIABLES = [
  "customer_name",
  "customer_email",
  "order_number",
  "order_total",
  "order_date",
  "delivery_date",
  "delivery_address",
  "payment_method",
  "store_name",
  "store_phone",
  "store_email",
  "support_url",
] as const;

export const defaultTemplateSampleData: Record<string, string> = {
  customer_name: "Priya Sharma",
  customer_email: "priya@example.com",
  order_number: "BK-1042",
  order_total: "₹1,468",
  order_date: "9 Jul 2026",
  delivery_date: "11 Jul 2026",
  delivery_address: "12 MG Road, Bengaluru 560001",
  payment_method: "UPI",
  store_name: "Monginis Bakery",
  store_phone: "+91 98765 43210",
  store_email: "sumanom7014106@gmail.com",
  support_url: "https://bakery.demo/store/contact",
  reset_link: "https://bakery.demo/account/reset-password?token=demo",
  invoice_url: "https://bakery.demo/store/order/BK-1042",
  coupon_code: "WELCOME10",
  cart_url: "https://bakery.demo/store/cart",

  // The rest of what the senders actually supply.
  //
  // These were missing, so `getSampleDataForVariables` filled them with
  // `[reset_code]`-style placeholders — and since it fills ANY unknown key that
  // way, nothing ever looked broken. The admin previewing the refund email saw
  // "[refund_amount]" where the customer will see a sum of money, and the real
  // test-send landed in their inbox the same way.
  reset_code: "482913",
  expires_in: "10 minutes",
  refund_note: "You paid for this order, so a refund is on its way. It usually takes 5–7 working days to reach your account.",
  refund_amount: "₹1,468",
  refund_eta: "5–7 working days",
  refund_reference: "rfnd_PmXq82Kd10Lb",
  customer_phone: "+91 90000 00000",
  order_items: "  1 x Black Forest (1 kg)\n  2 x Chocolate cupcake",
  admin_url: "https://bakery.demo/admin/orders/ord_1042",
};

/**
 * Sample values for a preview or a test send.
 *
 * `slug` is not optional decoration. Without it this returns the WHOLE table —
 * every variable any template might use — so a preview of the out-for-delivery
 * email renders a plausible `{{invoice_url}}` that its sender does not supply,
 * and the test send to the admin's own inbox renders it too. Both agree the
 * template is fine, and the customer receives the literal `{{invoice_url}}`.
 *
 * Given a wired slug, anything outside that sender's contract renders as
 * `[name]` instead — visibly a placeholder, which is exactly what it is. An
 * unwired slug has no contract to check against and keeps the old behaviour.
 */
export function getSampleDataForVariables(
  variables: string[],
  options?: { slug?: string; channel?: TemplateChannel },
): Record<string, string> {
  const slug = options?.slug;
  const contract = slug ? contractFor(options?.channel ?? "email")[slug] : undefined;

  const data: Record<string, string> = contract
    ? Object.fromEntries(
        contract
          .filter((name) => defaultTemplateSampleData[name] !== undefined)
          .map((name) => [name, defaultTemplateSampleData[name]]),
      )
    : { ...defaultTemplateSampleData };

  for (const variable of variables) {
    if (!data[variable]) {
      data[variable] = `[${variable}]`;
    }
  }
  return data;
}
