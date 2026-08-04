# Testing the payment path with real Razorpay keys

Everything below has been verified in code, in tests, and with HTTP requests
against a running build. **No real rupee has been through it.** This is the run
that closes that gap, and it needs credentials only the shop owner has.

Use **test keys** (`rzp_test_…`). Nothing here charges a real card.

---

## 1. Get the keys

[dashboard.razorpay.com](https://dashboard.razorpay.com) → **Account & Settings →
API Keys → Generate Test Key**.

The **Key Secret is shown once** and never again. Copy it now; if you lose it you
must generate a new pair.

## 2. Put them in

Either works. Environment wins if both are set.

**`.env.local`** (better for a deployed server — the secret never reaches the
database):

```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...        # step 3
```

Restart the server — the file is read at boot only.

**Or the admin panel:** Payments → Payment Gateways → Razorpay. If the two key
fields are greyed out, the environment variables above are set and win; remove
those two lines and restart to unlock the form.

## 3. Add the webhook — do not skip this

Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**.

| Field | Value |
| --- | --- |
| URL | `https://<your-domain>/api/razorpay/webhook` |
| Secret | any strong string you choose — paste the same one into the admin panel or `RAZORPAY_WEBHOOK_SECRET` |
| Events | `payment.captured`, `order.paid`, `refund.processed`, `refund.failed` |

Without it: a payment whose customer closed the tab never becomes an order, and
refunds stay at "processing" forever. The reconcile pass on the Refund Centre
covers the second case, nothing covers the first.

**Localhost will not work** — Razorpay needs a public URL. Use a tunnel
(`ngrok http 3000`) and put the tunnel URL in the webhook.

## 4. Confirm the keys are live

Payments → Payment Gateways → Razorpay. The badge must read **Connected · Test**.

- **Keys rejected** → Razorpay refused them. The message says why.
- **Keys set · unverified** → the check has not run; press **Test connection**.

This badge calls Razorpay. It is not derived from the variables being non-empty.

---

## 5. The runs

### A. A payment that completes

Place an order on the storefront, choose online payment, and pay with a
[Razorpay test card](https://razorpay.com/docs/payments/payments/test-card-details/)
(`4111 1111 1111 1111`, any future expiry, any CVV).

- [ ] Order success page shows the order number and **Paid**
- [ ] Admin → Orders shows it `confirmed`, payment `paid`
- [ ] Payments → Today's collection went up by the order total
- [ ] Transactions shows one row, status Captured, and **Volume matches
      Today's collection** — those two screens used to disagree
- [ ] Razorpay dashboard shows one captured payment for the same amount
- [ ] Product stock went down by the quantity ordered

### B. The customer closes the tab mid-payment — the important one

Start a payment, and **close the browser tab after the card is authorised but
before the success page loads.**

- [ ] Razorpay shows the payment captured
- [ ] Within a minute or two the order appears in Admin → Orders anyway
      (the webhook placed it)
- [ ] The confirmation email went out
- [ ] Payments shows **no** "money received with no order" alert

If the order does not appear: the webhook is not reaching you. Check
Razorpay Dashboard → Webhooks → the delivery log. A `503` means the secret is not
configured; a timeout means the URL is not reachable.

### C. Money that arrives with no order

Hard to trigger deliberately. If it happens, Payments shows a red alert at the
top with the amount, the payment id, and whatever contact detail the gateway had.
That is money to place by hand or refund.

### D. A full refund

Admin → Payments → Refunds → pick the order from run A → **Issue refund** → Full.

- [ ] The toast says the refund was **sent to the gateway** — not "recorded"
- [ ] The refund shows **Processing**, not Completed
- [ ] Razorpay dashboard shows a refund with a `rfnd_…` id, status pending
- [ ] The customer gets the refund email
- [ ] The customer's own order page (Track order → their email) shows it too

Then, once Razorpay settles it (test mode is usually quick):

- [ ] The webhook flips it to **Completed**, or opening the Refund Centre does
      (that page reconciles on load)
- [ ] The order reads `refunded`
- [ ] Payments: collection dropped by the refunded amount; the Refunds card went
      up by the same
- [ ] The customer's invoice shows a **Refunded** line and a **Net paid** line

### E. A partial refund

Place another order. Refund a part of it.

- [ ] Only the part you asked for leaves, at the gateway
- [ ] The order does **not** flip to `refunded` — it is not fully refunded
- [ ] You can refund more afterwards, up to the remainder
- [ ] Refunding more than the remainder is refused, with the gateway's reason
- [ ] Collection dropped by the refunded part only, not the whole order

### F. Refusals say why

- [ ] Refund an order twice over — refused, with a reason, no second payout
- [ ] Refund a COD order that was never delivered — refused
- [ ] With the server stopped, press Refund — it says the gateway could not be
      reached and records nothing

---

## If something is wrong

| Symptom | Look at |
| --- | --- |
| Badge says Keys rejected | The keys themselves. The message is Razorpay's. |
| Payment succeeds, no order | Webhook delivery log in the Razorpay dashboard. |
| Refund stuck at Processing | Open the Refund Centre — it reconciles on load. If it stays, the `refund.processed` event is not subscribed. |
| "Money received with no order" alert | Real money without a cart. Place the order by hand or refund it from the Razorpay dashboard. |
| Two orders for one payment | Should be impossible — the draft is claimed before the order is inserted. Report it with both order numbers. |

Server logs are prefixed `[razorpay]` and `[orders]`.
