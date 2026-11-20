# Sweet Crumbs — Google Play listing

Everything the Play Console asks for, ready to paste. Replace `<SHOP-URL>` with
the shop's live https address once the site is online.

## App details

| Field | Value |
|---|---|
| App name | Sweet Crumbs |
| Package (cannot change after the first upload) | `in.sweetcrumbs.app` |
| Category | Food & Drink |
| Contact email | the shop's contact email (Admin → Settings) |
| Contact phone | the shop's phone (optional) |
| Website | `<SHOP-URL>/store` |
| Privacy policy | `<SHOP-URL>/store/privacy` |

## Short description (80 characters max)

```
Fresh cakes, pastries and gifts from Sweet Crumbs, delivered in Kota.
```

## Full description (4000 characters max)

```
Order fresh cakes, pastries and gifts from Sweet Crumbs Bakery in Kota, and get them delivered to your door.

• Browse the full menu with photos, prices and weights
• Choose the weight, flavour and shape, and add a message for the cake
• Photo cakes: upload your own picture to print on the cake
• Pick a delivery date and time slot that suits you
• Drop a pin on the map so the rider finds you, and see the exact delivery charge before you pay
• Pay online with UPI, cards or netbanking (Razorpay), or choose cash on delivery where available
• Apply coupons and add gift wrap
• Save your addresses for quicker checkout next time
• Track your orders and cancel before preparation starts, where the product allows it
• Sign in with just your email and a one-time code — no password to remember

Baked fresh every day. Same-day delivery on orders placed before the shop's cut-off time.
```

## Graphics (files in this folder)

| Asset | File | Status |
|---|---|---|
| App icon 512×512 | `icon-512.png` | ready |
| Feature graphic 1024×500 | `feature-graphic-1024x500.png` | ready |
| Phone screenshots (2–8, 1080×1920 or similar) | — | take from the release build on a phone: Home, Product, Cart, Checkout map, Orders |

## Data safety form

**Does the app collect or share user data?** Yes. **Is all data encrypted in
transit?** Yes, once the app points at the https site. **Can users ask for
their data to be deleted?** Yes: in the app (Account → Delete account) and on
the website (Account page → Delete account).

| Data type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| Name | Yes | No | Required to order | App functionality (orders, delivery) |
| Email address | Yes | No | Required (sign-in) | Account management, app functionality |
| Phone number | Yes | No | Required to order | App functionality (delivery contact) |
| Address | Yes | No | Required to order | App functionality (delivery) |
| Precise location | Yes | No | Optional (only when "Use my location" is tapped) | App functionality (delivery pin) |
| Photos | Yes | No | Optional | App functionality (photo cakes, profile picture) |
| Purchase history | Yes | No | — | App functionality (orders) |
| Payment info | No — Razorpay handles card/UPI details; the app never sees them | — | — | — |

"Shared" means sent to a third party for its own use. Payment processing,
image storage and email delivery are *service providers* acting for the shop,
which Play does not count as sharing.

Data is **not** used for advertising or analytics, and the app contains no ads.

## Account deletion (required by Play)

- In-app path: **Account → Delete account**.
- Web link for the form: `<SHOP-URL>/store/account` (sign in, then **Delete account** at the bottom).
- What is deleted: name, phone, saved addresses, profile photo, sign-in. What is kept: past orders and invoices, for tax law.

## Content rating questionnaire

No violence, sexual content, gambling, drugs or user-to-user chat. The app
sells food and takes payments → expect rating **Everyone / 3+**.

## Target audience

18 and over (the shop takes payments).

## Release

```
flutter build appbundle --release --dart-define=API_BASE_URL=<SHOP-URL>
```

Upload `build/app/outputs/bundle/release/app-release.aab`. Signing uses the
upload key described in `C:\Users\TPW USER\.android-keys\README-sweet-crumbs-key.txt`; keep
Play App Signing switched on.
