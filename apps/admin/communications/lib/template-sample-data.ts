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
  store_email: "hello@monginis.demo",
  support_url: "https://bakery.demo/store/contact",
  reset_link: "https://bakery.demo/account/reset-password?token=demo",
  invoice_url: "https://bakery.demo/store/order/BK-1042",
  coupon_code: "WELCOME10",
  cart_url: "https://bakery.demo/store/cart",
};

export function getSampleDataForVariables(variables: string[]): Record<string, string> {
  const data: Record<string, string> = { ...defaultTemplateSampleData };
  for (const variable of variables) {
    if (!data[variable]) {
      data[variable] = `[${variable}]`;
    }
  }
  return data;
}
