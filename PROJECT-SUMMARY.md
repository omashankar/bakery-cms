# 🍰 Bakery CMS — Complete Project Summary

> Ye document pure project ka overview hai — backend planning ke liye. Isme project ki har cheez cover hai:
> tech stack, folder structure, saare features, saare pages, data kaise store hota hai, auth, aur backend
> ke liye kya-kya karna baaki hai.

---

## 1. Project kya hai?

Ye ek **Multi-Business-Type CMS + eCommerce Storefront** hai.

- Default business type = **bakery** (cakes bechne wali site)
- Lekin same code se **flower shop, restaurant, sweet shop, gift shop, grocery, fashion, electronics, pharmacy**
  bhi ban sakti hai — sirf wording (labels) aur kuch fields ki visibility badalti hai, code same rehta hai.

Do main hisse:
- **Storefront** (`apps/website/`) → customer wali public website
- **Admin / CMS Panel** (`apps/admin/`) → owner/admin ka control panel (sab kuch yahan se manage hota hai)

---

## 2. Tech Stack

| Cheez | Detail |
|---|---|
| **Framework** | Next.js **16.2.10** (App Router) — ⚠️ custom/naya version, standard Next.js se alag ho sakta hai |
| **UI Library** | React 19, Tailwind CSS v4, shadcn (style: base-nova), Base UI primitives |
| **Icons / Animation / Toasts** | lucide-react, framer-motion, sonner |
| **Forms + Validation** | react-hook-form + **zod** |
| **Payments** | **Razorpay** (`razorpay` npm package) — asli integration |
| **Testing** | vitest + jsdom |
| **Database** | ❌ **KOI NAHI** (ye backend ka main kaam hai) |
| **Auth Library** | ❌ Koi nahi — abhi fake/demo auth hai |

> ⚠️ **AGENTS.md warning:** Ye Next.js ka naya version hai. Code likhne se pehle
> `node_modules/next/dist/docs/` me relevant guide padhni chahiye — purani conventions alag ho sakti hain.

---

## 3. Folder Structure (top-level)

```
bakery-cms/
├── app/                  → Next.js App Router (routes, pages, API handlers)
│   ├── (admin)/          → /admin/... ke saare pages (route group)
│   ├── (auth)/           → login, otp, forgot/reset password
│   ├── (storefront)/     → /store/... public pages
│   ├── account/          → customer account pages
│   ├── api/              → API route handlers (products, pages, razorpay, etc.)
│   ├── layout.tsx        → root layout
│   └── page.tsx          → "/" landing page (CMS product ka marketing page)
│
├── apps/
│   ├── admin/            → admin panel ka UI (dashboard, catalog, commerce, settings...)
│   └── website/          → storefront ka UI (checkout, account, landing, pages)
│
├── features/            → 18 domain modules (asli business logic yahan) — details section 5 me
│
├── lib/
│   ├── server/
│   │   └── json-store.ts → ⭐ DATA STORAGE ENGINE (database yahan aayega)
│   ├── business-blocking.ts → business-type gating (flash-free)
│   ├── admin-breadcrumbs.ts / admin-settings-pages.ts → admin nav helpers
│   ├── theme.ts / motion.ts / utils.ts
│
├── components/          → shared React components (ui/, providers/, storefront/, shared/)
├── types/               → ~25 global TypeScript types (product.ts, order..., settings.ts, etc.)
├── config/              → business-labels.ts (multi-business wording)
├── hooks/               → use-business-labels.ts etc.
├── constants/ utils/ layouts/ styles/ assets/ public/ scripts/ tests/
│
├── .data/               → ⭐ JSON "database" files (abhi sirf products.json hai)
├── .env.local           → asli secrets (MONGODB_URI + Razorpay) — git-ignored
├── .env.example         → template (placeholders)
├── AGENTS.md / CLAUDE.md → project conventions
└── next.config.ts / tsconfig.json / package.json
```

Path alias: `@/*` → project root (e.g. `import { x } from "@/lib/utils"`).

---

## 4. 🔴 Data abhi kaise store hota hai (BACKEND KE LIYE SABSE ZAROORI)

Abhi **koi real database nahi hai**. Data 2 temporary jagah store hota hai:

### A) Server-side JSON files → `.data/` folder
Engine: **`lib/server/json-store.ts`** ka `createJsonStore()` function.
- Lock + atomic writes ke saath JSON file padhta/likhta hai
- File comment: *"This is the seam the real database will replace"* → **yahi jagah hai jahan MongoDB aayega**
- Har store ke methods: `read()`, `write()`, `mutate()`, `reset()`
- **Sab callers already `await` karte hain** → matlab backing ko MongoDB se replace karne pe call sites nahi badalne padenge

Abhi sirf **4 cheezein** server JSON me hain:
| Store | File |
|---|---|
| Products (cakes) | `.data/products.json` ✅ (disk pe maujood) |
| CMS Pages | `.data/pages.json` (first use pe banegi) |
| Homepage builder sections | `.data/homepage-sections.json` |
| Wedding builder sections | `.data/wedding-sections.json` |

### B) Browser localStorage → `bakery-cms-*` keys
**Baaki SAB kuch** browser ki localStorage me hai. ⚠️ Problem: ye **har browser me alag** hota hai, server ko dikhta hi nahi. Iska matlab abhi orders/customers waqai kahin permanently save nahi ho rahe.

localStorage me store hone wali cheezein:
`orders`, `cart` (+saved-for-later, +preferences), `catalog`, `coupons`, `delivery-zones`,
`invoice-settings`, `banners`, `faq`, `testimonials`, `product-reviews`, `inquiries`,
`newsletter-subscribers`, `seo`, `settings`, `security-center`, `header`, `footer`, `demo-session`.

> **Backend goal:** localStorage + JSON files → sab MongoDB me le jaana.

---

## 5. Features (18 modules) — kya-kya manage hota hai

| # | Feature | Kaam | Data abhi kahan | Key data fields |
|---|---|---|---|---|
| 1 | **products** | Cakes/products catalog | JSON + localStorage | id, name, slug, price, images[], categoryId, weights[], variants, stock, seo, flags (eggless/photoCake/featured...) |
| 2 | **catalog** | Master lists products refer karte hain | localStorage | categories, flavours, occasions, weights |
| 3 | **orders** | Order place, status, refund/cancel | localStorage ⚠️ | orderNumber, items[], totals, address, paymentStatus, status (pending→delivered), statusHistory, refundRecord |
| 4 | **cart** | Cart, saved-for-later, preferences | localStorage | productSlug, name, price, qty, weight, flavour, variants, deliveryDate |
| 5 | **commerce** | Coupons, delivery zones, invoice settings | localStorage | coupon(code, percentOff/flatOff, usage), deliveryZone(pincode, charge, days), invoice(company, GST) |
| 6 | **payments** | Razorpay + gateways, transactions, refunds | Razorpay REAL, baaki demo | gateway registry (12 gateways), transactionView (orders se derived) |
| 7 | **content** | CMS pages, banners, FAQ, testimonials | JSON (pages) + localStorage | page(title, slug, blocks[], status), testimonial, faq, banner |
| 8 | **cms-sections** | Homepage + wedding drag-drop builder | JSON | draft vs published snapshots, sections[] (hero, menu, categories, featured...) |
| 9 | **builders** | Revision history helper (undo, max 8) | localStorage | BuilderRevision(id, savedAt, sections[]) |
| 10 | **reviews** | Product reviews + moderation | localStorage | cakeId, rating, body, status (pending/approved/rejected), adminReply |
| 11 | **inquiries** | Contact/wedding leads, newsletter | localStorage | type, name, email, message, status; subscriber(email) |
| 12 | **settings** | Global settings, business-type, modules | localStorage | general(businessType, currency), contact, social, security, smtp, commerce, modules, activityLog |
| 13 | **seo** | Global + per-route SEO metadata, sitemap | localStorage | global(siteName, ogImage), routes[](path, metaTitle, metaDesc) |
| 14 | **site-layout** | Storefront header + footer config | localStorage | header(logo, nav[], cta), footer(columns[], links[]) |
| 15 | **auth** | Login/session + password reset (DEMO) | localStorage ⚠️ | session {email, signedInAt} — fake |
| 16 | **marketing** | CMS product ka landing page (static) | none | static feature/icon arrays |
| 17 | **architecture** | Internal docs page | none | — |
| 18 | **design-system** | Internal UI showcase page | none | — |

### Domain relationships (kaun kis se juda)
- **Product** ← reference hota hai → Cart, Order.items, Review; iske categoryId/flavourId → catalog
- **Cart → Order**: checkout pe cart items + totals + address + coupon copy ho ke Order banta hai
- **Commerce** → coupons/delivery/invoice Order me use hote hain
- **Payments.Transaction** = Order ka projection (alag se save nahi hota)
- **Settings.commerce** → order numbering, tax, delivery control karta hai
- **Settings.modules** → product ke fields (eggless/photo/weight/shape) aur wedding builder dikhne ko toggle karta hai

---

## 6. Pages / Routes (complete list)

### Storefront (public) — ~22 pages
```
/                                → CMS product marketing landing
/store                           → storefront home
/store/about, /contact, /faq, /gallery, /privacy, /terms, /thank-you, /search
/store/cakes/[slug]              → single product detail
/store/collections               → collections list
/store/collections/[slug]        → single collection
/store/cart                      → cart
/store/checkout                  → checkout
/store/wishlist
/store/wedding-cakes             → wedding landing
/store/order/[orderNumber]       → order detail
/store/order/[orderNumber]/invoice
/store/order/success, /store/order/track
/store/pages/[slug]              → CMS-authored custom page
```

### Customer Account
```
/account            → dashboard
/account/orders     → order history
/account/addresses  → saved addresses
```

### Auth
```
/login, /otp, /forgot-password, /reset-password
/auth/error, /auth/session-expired, /auth/success
```

### Admin Panel (`/admin/...`) — ~65+ pages
```
/admin                          → redirects to dashboard
/admin/dashboard                → main dashboard
/admin/appearance               → theme/appearance
/admin/banners                  → banners
/admin/builders/homepage        → homepage builder
/admin/builders/wedding         → wedding builder
/admin/cakes                    → products list
/admin/cakes/add                → add product
/admin/cakes/[id]/edit          → edit product
/admin/cakes/[id]/preview       → preview product
/admin/catalog                  → categories/flavours/occasions
/admin/customers                → customers list
/admin/customers/[id]           → customer detail
/admin/faq, /testimonials       → content
/admin/footer, /header          → layout editors
/admin/media                    → media library
/admin/orders                   → orders list
/admin/orders/[id]              → order detail
/admin/pages                    → CMS pages list
/admin/pages/add                → add page
/admin/pages/[id]/edit          → edit page
/admin/profile, /profile/password
/admin/reports                  → analytics/reports
/admin/seo                      → SEO management

--- Commerce ---
/admin/commerce/coupons, /delivery-slots, /delivery-zones, /emails,
/inventory, /invoices, /notifications, /reviews, /shipping-rules,
/taxes, /whatsapp, /payments
/admin/commerce/payments/gateways
/admin/commerce/payments/gateways/[id]
/admin/commerce/payments/notifications, /refunds, /transactions

--- Inquiries ---
/admin/inquiries, /inquiries/contact, /inquiries/newsletter, /inquiries/wedding

--- Settings ---
/admin/settings                 → hub
/admin/settings/activity, /analytics, /backup, /commerce, /contact,
/custom-code, /general, /maintenance, /modules, /navigation, /permissions,
/security, /seo-files, /sms, /smtp, /social
```

### API Routes (`app/api/.../route.ts`) — 9 handlers
| Route | Methods | Kaam |
|---|---|---|
| `/api/products` | GET, POST | products list / create |
| `/api/products/[id]` | GET, PUT, DELETE | single product CRUD |
| `/api/pages` | GET, POST | CMS pages list / create |
| `/api/pages/[id]` | GET, PUT, DELETE | single page CRUD |
| `/api/homepage-sections` | GET, PUT, POST | homepage builder sections |
| `/api/wedding-sections` | GET, PUT, POST | wedding builder sections |
| `/api/razorpay/config` | GET, POST, DELETE | Razorpay config save/read |
| `/api/razorpay/order` | POST | payment order create |
| `/api/razorpay/verify` | POST | payment signature verify |

---

## 7. 🔓 Auth abhi FAKE hai (backend priority)

- Login: koi bhi email chalta hai, **koi bhi password chalega** (sirf literal `"invalid"` reject hota hai)
- Koi real users database nahi, koi password hashing nahi, koi cookie/JWT nahi
- "Session" = `{ email, signedInAt }` localStorage/sessionStorage me
- **Koi `middleware.ts` nahi hai** → `/admin` routes protected nahi, koi bhi khol sakta hai
- OTP aur password reset bhi fake (koi asli email/SMS nahi jaata)
- Activity logs me userId hamesha hardcoded `"admin"` — single admin identity

---

## 8. Multi-Business-Type System (kaise reusable banta hai)

3 pieces, sab `settings.general.businessType` (default "bakery") + `modules` flags se chalte hain.
**Kabhi routes/folders/storage keys nahi badalte — sirf wording aur visibility.**

1. **Business Labels** (`config/business-labels.ts` + `hooks/use-business-labels.ts`)
   - "Cakes" → "Flowers"/"Dishes" jaise words badal jaate hain business type ke hisaab se
2. **Modules** (`/admin/settings/modules`)
   - Bakery-specific features toggle: weddingBuilder, flavour, eggEggless, weight, shape, photoCake
   - Off karne pe **sirf UI se field chhupti hai, data delete nahi hota**
   - Wedding module sirf tab jab businessType === bakery
3. **Flash-free gating** (`lib/business-blocking.ts`)
   - Pre-paint inline script `data-*` attributes `<html>` pe lagata hai → CSS `data-gate-*` off modules chhupata hai (koi flicker nahi)
   - Bakery default me koi gating nahi → dikhta sab kuch, byte-for-byte same

---

## 9. Payments (high-level)

Do layer:
1. **Registry/demo layer** (`features/payments/`) — 12 gateways ka static catalogue (Razorpay, COD, Stripe, PayPal, PhonePe, PayU, etc.). Sirf **Razorpay + COD asli (isCore)**, baaki placeholders.
2. **Real Razorpay checkout** (ekmaatra sacha server integration):
   - Credentials: env vars `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (ya gitignored `.razorpay-config.json`)
   - `/api/razorpay/order` → server pe order banata hai (rupees→paise)
   - `/api/razorpay/verify` → signature verify
   - Client: `apps/website/checkout/lib/razorpay.ts` → order create → hosted modal → verify
   - Credentials na ho to 503 "Cash on Delivery choose karo" message

---

## 10. Environment Variables

`.env.local` (git-ignored, asli values):
```
MONGODB_URI=mongodb+srv://...@cluster0.56o1kzq.mongodb.net/bakery-cms   ✅ ready hai
RAZORPAY_KEY_ID=rzp_test_...      (abhi placeholder — asli bharni hai)
RAZORPAY_KEY_SECRET=...           (abhi placeholder — asli bharni hai)
```
`.env.example` → sirf placeholders (template).

---

## 11. 🎯 Backend ke liye kya-kya karna hai (roadmap)

MongoDB URI ready hai. Roughly ye scope hai:

1. **MongoDB connection** — `mongoose` (ya `mongodb` driver) install karna (abhi nahi hai). Connection helper banana, `lib/server/json-store.ts` wale seam ko Mongo se replace/extend karna.
2. **Schemas/Models** — har feature ke liye Mongoose models (Product, Order, Customer, Coupon, Page, Review, Inquiry, Settings, etc.)
3. **Real Auth** — users collection, password hashing (bcrypt), sessions/JWT, `middleware.ts` se `/admin` routes protect karna, real OTP/email reset
4. **localStorage → server migration** — orders, customers, coupons, settings, reviews, inquiries wagairah ko server + MongoDB me lana (abhi ye browser me atke hain)
5. **API routes** — har feature ke liye CRUD API handlers (abhi sirf products/pages/razorpay ke hain)
6. **File/media uploads** — media library ke liye asli storage (abhi kya hai check karna hoga)

### ⚠️ Dhyaan rakhne wali baatein
- Next.js version naya hai → `node_modules/next/dist/docs/` padhna
- Storage abstraction pehle se hai (`json-store.ts`) → use samajh kar replace karna, taaki call sites na toote
- Multi-business-type system ko na todna — wo settings-driven hai

---

*Generated for backend planning. Koi feature detail me chahiye ho to file paths upar diye gaye hain.*
