# 🏛️ Bakery CMS → White-Label Commerce CMS — Backend Architecture Plan

> Enterprise-grade backend blueprint. Ye document architecture, conventions, module mapping, aur
> phase-wise roadmap define karta hai. **Har module isi plan ke hisaab se banega.**
> Reference: [PROJECT-SUMMARY.md](PROJECT-SUMMARY.md) (frontend overview).

---

## 0. Reconciled Decisions (prompt vs reality)

Prompt enterprise-grade tha, par 2 cheezein reality ke hisaab se adjust hui hain:

| Prompt me tha | Final decision | Kyun |
|---|---|---|
| PostgreSQL + Prisma | **MongoDB + Mongoose** | User ne MongoDB Atlas choose kiya (`.env.local` ready). Relations refs se, integrity Service layer par. |
| `middleware.ts` | **`proxy.ts`** | Next.js 16 me middleware → proxy rename ho gaya (breaking change). |
| `src/controllers/services/...` | Layered code **`features/<module>/server/`** me, thin handlers `app/api/` me | Next.js route handlers sirf `app/` me chal sakte hain; project already `features/` convention use karta hai. |

**Non-negotiable rules (prompt se, strictly follow honge):**
- ❌ Koi route/page/component rename nahi
- ❌ UI redesign nahi, navigation change nahi, Bakery terminology UI se nahi hategi
- ✅ Business Config Layer banega (labels DB-driven), white-label config se
- ✅ Clean architecture: Controller → Service → Repository → DB (koi business logic route me nahi)
- ✅ Har module production-ready hone ke baad hi next module
- ✅ Migration ke time backward-compatibility (localStorage + API dono chalein jab tak switch na ho)

---

## 1. Backend Tech Stack (final)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Next.js 16 Route Handlers (`app/api/**/route.ts`) | Node runtime |
| Language | TypeScript (strict) | already configured |
| Database | MongoDB Atlas | `MONGODB_URI` ready in `.env.local` |
| ODM | **Mongoose** | schemas + refs + transactions (Atlas replica-set) |
| Validation | **Zod** | ✅ already installed |
| Auth tokens | **jose** (JWT) | edge+node safe; access + refresh tokens |
| Password hash | **bcryptjs** | pure-JS (Windows pe native build issue nahi) |
| Route protection | **`proxy.ts`** (root) | optimistic checks; secure checks DAL me |
| File storage | Cloudinary | Phase: Media |
| Payments | Razorpay | ✅ already integrated (server verify) |
| Email | SMTP (nodemailer) | Phase: Notifications |

**Naye dependencies install honge:** `mongoose`, `jose`, `bcryptjs`, `@types/bcryptjs`
(baad ki phases me: `cloudinary`, `nodemailer`, `@types/nodemailer`)

---

## 2. Folder Structure (Clean Architecture, Next.js-adapted)

```
lib/server/
  db/
    mongoose.ts              → cached DB connection (hot-reload/serverless safe)
    models/                  → Mongoose schemas
      user.model.ts
      session.model.ts
      refresh-token.model.ts
      role.model.ts
      store.model.ts
      ... (per module)
  http/
    response.ts              → success()/fail() → standard envelope
    errors.ts                → AppError, ValidationError, AuthError... + handler
    validate.ts              → zod parse helper (throws ValidationError)
    pagination.ts            → page/limit/sort parsing
  auth/
    password.ts              → bcryptjs hash/compare
    jwt.ts                   → jose sign/verify (access + refresh)
    cookies.ts               → httpOnly cookie set/clear (access+refresh)
    dal.ts                   → verifySession(), getCurrentUser(), requireRole()
  audit/
    audit-log.ts             → writeAuditLog() helper (every admin action)

features/<module>/server/
  <module>.repository.ts     → ONLY data access (Mongoose queries)
  <module>.service.ts        → business logic, transactions, orchestration
  <module>.validators.ts     → zod schemas (input contracts)
  <module>.controller.ts     → parse → validate → service → response envelope

app/api/<module>/route.ts    → THIN: import controller, call, return
proxy.ts                     → root: route protection (Next 16 middleware)
```

**Request lifecycle:**
```
HTTP → app/api/*/route.ts (thin)
     → controller (validate + shape response)
     → service (business logic + authz + audit)
     → repository (Mongoose)
     → MongoDB
```
Route handler me kabhi DB call ya business logic nahi. Controller me kabhi direct DB nahi.

---

## 3. Standard API Response Envelope (har endpoint)

**Success:**
```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 135, "totalPages": 7 },
  "errors": null,
  "timestamp": "2026-07-24T10:00:00.000Z"
}
```

**Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "pagination": null,
  "errors": [ { "field": "email", "message": "Invalid email" } ],
  "timestamp": "2026-07-24T10:00:00.000Z"
}
```

`pagination` sirf list endpoints me. Ye envelope naye backend APIs me use hoga; purane
(`/api/products` etc.) as-is chalte rahenge jab tak un modules ki migration na ho (backward compat).

**Global error handling:** controllers ek `withErrorHandler()` wrapper use karenge jo `AppError`
subclasses ko sahi HTTP status + envelope me convert karta hai (400 validation, 401 auth,
403 forbidden, 404 not found, 409 conflict, 500 internal).

---

## 4. White-Label / Business Config Layer (core reusability)

Ye wo layer hai jo Bakery ko **koi bhi retail business** bana deta hai — bina code badle.

**`Store` collection (single document per install):**
```
Store {
  businessType: "bakery" | "cake-shop" | "sweet-shop" | "flower-shop" |
                "gift-shop" | "chocolate-shop" | "dry-fruit-shop" |
                "restaurant" | "cafe" | "ice-cream-shop" | "pet-shop" |
                "organic-store" | "other"
  labels: {
    product: "Cake",          // UI me "Cake" dikhta rahega (bakery default)
    productPlural: "Cakes",
    customProduct: "Wedding Cake",
    variant: "Flavour",
    catalog: "Collection",
    ...
  }
  modules: { weddingBuilder, flavour, eggEggless, weight, shape, photoCake, ... }
  general, contact, social, commerce, seo ... (existing AppSettings shape)
}
```

- Frontend already `config/business-labels.ts` + `useBusinessLabels()` use karta hai — ab wo
  values **DB se aayengi** (localStorage `bakery-cms-settings` ki jagah), API ke through.
- Default seed = **bakery** → UI byte-for-byte same rahegi.
- Admin baad me `/admin/settings/general` + `/admin/settings/modules` se labels/modules edit karega.
- Backward compat: jab tak Store API live na ho, existing localStorage labels chalte rahein.

---

## 5. Module → MongoDB Collection Mapping

| Domain | Collections | Source (abhi) |
|---|---|---|
| **Auth** | users, sessions, refresh_tokens, roles | localStorage demo-session |
| **Store/Settings** | stores (business type, labels, modules, settings) | localStorage settings |
| **Products** | products, categories, variants (embedded), inventory, reviews | products.json + localStorage |
| **Catalog** | categories, flavours, occasions, weights | localStorage catalog |
| **Orders** | orders, order_items (embedded), order_timeline (embedded), addresses | localStorage orders |
| **Payments** | transactions, refunds, payment_gateways | derived/localStorage |
| **Coupons** | coupons, coupon_redemptions | localStorage coupons |
| **Delivery** | delivery_zones, delivery_slots, shipping_rules | localStorage |
| **Invoices** | invoices, invoice_settings | localStorage |
| **Customers** | customers, addresses, wishlists, recently_viewed | localStorage (new) |
| **CMS** | pages, homepage_sections, wedding_sections, banners, testimonials, faqs | JSON + localStorage |
| **Media** | media_assets (Cloudinary refs) | none (new) |
| **SEO** | seo_settings (global + routes) | localStorage seo |
| **Site Layout** | header_settings, footer_settings | localStorage |
| **Inquiries** | inquiries, newsletter_subscribers | localStorage |
| **Notifications** | notifications (admin + customer) | none (new) |
| **Audit** | audit_logs, activity_logs | localStorage activity |

---

## 6. Phase Roadmap (module-by-module, prompt order)

Har module ke liye 10-step workflow: **Schema → Model → Repository → Service → Validation →
Controller → Routes → Testing → Integration → Docs.** Ek module production-ready hone ke baad hi next.

| Phase | Module | Delivers |
|---|---|---|
| **1** | **Authentication** ⬅️ START | login, logout, refresh, forgot/reset/change password, JWT+refresh, proxy protection, RBAC base |
| 2 | Store Settings / Business Config | white-label labels + modules + settings API |
| 3 | Products | product CRUD, images, SKU/barcode, flags |
| 4 | Categories / Catalog | categories, flavours, occasions, weights |
| 5 | Inventory | stock, reserved, low-stock, history |
| 6 | Orders | order flow + timeline (draft→completed), addresses |
| 7 | Payments | transactions, verify, refunds, invoices |
| 8 | Customers | CRUD, addresses, wishlist, reorder, tags, blocked |
| 9 | Coupons / Delivery | coupons, zones, slots, shipping rules |
| 10 | CMS | pages, homepage, wedding, banners, testimonials, FAQ |
| 11 | Media | Cloudinary upload/delete sync |
| 12 | Notifications / Email / WhatsApp | DB notifications, SMTP templates, WA templates |
| 13 | SEO / Site Layout / Inquiries | metadata, header/footer, leads, newsletter |
| 14 | Audit / Analytics | audit logs everywhere, reports |

---

## 7. PHASE 1 — Authentication (detailed deliverables)

**Data model (collections):**
- `users` — { name, email (unique), passwordHash, role (ref/enum), avatar?, status, lastLoginAt, createdAt, updatedAt }
- `roles` — { name, description, isSystem, permissions[] } (seeded: Owner, Manager, Editor, Viewer — from `types/permissions.ts`)
- `sessions` — { userId, userAgent, ip, createdAt, lastSeenAt, expiresAt } (device/session list, "logout all")
- `refresh_tokens` — { userId, tokenHash, expiresAt, revokedAt? } (rotation + revocation)

**Auth flow:**
- `bcryptjs` password hashing (cost 10)
- **Access token** (JWT, ~15 min) → httpOnly cookie `access_token`
- **Refresh token** (JWT, ~7–30 days, "remember me") → httpOnly cookie `refresh_token`, DB me hashed stored
- Refresh rotation: har refresh pe purana revoke, naya issue
- `proxy.ts` → `/admin/*` protected (optimistic cookie check), `/login` pe logged-in redirect
- DAL `verifySession()` / `requireRole()` → route handlers + server components me secure check

**Endpoints (`/api/auth/*`, standard envelope):**
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/login` | email+password → set cookies, return user |
| POST | `/api/auth/logout` | clear cookies + revoke refresh + end session |
| POST | `/api/auth/refresh` | rotate refresh → new access |
| GET | `/api/auth/me` | current user (DAL) |
| POST | `/api/auth/forgot-password` | issue reset token (email later) |
| POST | `/api/auth/reset-password` | token + new password |
| POST | `/api/auth/change-password` | old + new (authed) |

**Files (Phase 1):**
```
lib/server/db/mongoose.ts
lib/server/db/models/{user,role,session,refresh-token}.model.ts
lib/server/http/{response,errors,validate}.ts
lib/server/auth/{password,jwt,cookies,dal}.ts
lib/server/audit/audit-log.ts
features/auth/server/{auth.repository,auth.service,auth.validators,auth.controller}.ts
app/api/auth/{login,logout,refresh,me,forgot-password,reset-password,change-password}/route.ts
proxy.ts
scripts/seed-admin.ts        → seed first admin + roles
```

**Frontend integration (no UI change):**
- `features/auth/lib/session.ts` — internally real cookie-backed session se replace, same exported
  functions (`getDemoSession` etc.) taaki calling components na toote (backward compat)
- Login form → real `/api/auth/login` call; success pe same redirect behaviour
- Reset flow (`/forgot-password → /otp → /reset-password`) → real endpoints se wire

**Testing:** vitest — password hash/compare, jwt sign/verify, validators, service (login success/fail,
refresh rotation, reset flow). Integration: login→me→refresh→logout cycle.

**Env additions (`.env.local`):**
```
JWT_ACCESS_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
```

---

## 8. Security baseline (applied across all phases)

- All input Zod-validated server-side (never trust client)
- httpOnly + secure + sameSite cookies; no tokens in localStorage
- Password hashing bcryptjs; never store/return plaintext or hash
- Rate limiting on auth endpoints (login/forgot) — in-memory first, Redis-ready later
- Role middleware (`requireRole`) on admin mutations
- Audit log on every create/update/delete/login/logout/refund/inventory/payment change
- Payment status never trusted from client — always server signature verify (already done for Razorpay)
- Mongoose = parameterized queries (NoSQL-injection safe); still validate shapes

---

*Approval milne par Phase 1 isi 10-step workflow se shuru — pehle deps + DB connection + models,
phir repository → service → validators → controller → routes → tests → frontend wiring.*
