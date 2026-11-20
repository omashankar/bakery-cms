# Bakery customer app

The shop's storefront as a Flutter app: browse, product page, cart, sign-in
with an emailed code, checkout (map pin, delivery slot, COD or Razorpay), and
order history. It talks to the same Next.js backend as the website; every
price is computed by the server.

## Run it

```sh
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # after changing any model

# Phone or emulator → the dev server on this computer (npm run dev in the repo root).
# The tunnel is needed once each time the device connects.
adb reverse tcp:3000 tcp:3000
flutter run

# The live shop
flutter run --release --dart-define=API_BASE_URL=https://your-shop-domain
```

Plain `http` works only in debug builds (`android/app/src/debug`); release
builds must use `https`. Razorpay opens only on Android and iOS; elsewhere
checkout offers cash on delivery.

## Check it

```sh
flutter analyze   # must say "No issues found!"
flutter test
```

## How it is built

Feature-first clean architecture with BLoC:

```
lib/
  app/        App widget, router (go_router + sign-in redirects), theme, DI (get_it)
  core/       constants & strings, errors, Dio client + interceptors, utils, shared widgets
  features/
    store/    public shop settings (tiers, slots, payment methods)
    catalog/  home, categories, listing, search, product page
    cart/     the cart, saved on the device
    auth/     email + 6-digit code sign-in
    checkout/ address, map pin, delivery, coupon, payment, place order
    orders/   order history and detail, customer cancellation
    account/  profile and sign out
```

Each feature has `data/` (models, data sources, repository implementation),
`domain/` (entities, repository interface, use cases) and `presentation/`
(bloc, pages, widgets), and registers itself in `<feature>_injection.dart`.

Rules the code follows:

- **Errors:** data sources throw typed exceptions. Repositories return
  `Either<Failure, T>` through `guard()`. Blocs put `Failure.message` in
  state; it is always customer-safe text.
- **Screen states:** every screen shows loading, empty, error-with-retry and
  content through `StateView`. A failed refresh keeps the content and shows a
  snackbar (`FailureSnackbarListener`).
- **No literals in widgets:** colours, spacing and copy come from `AppTheme`,
  `AppSpacing` and `core/constants/strings/`.
- **Sign-in:** the shop keeps the session in an httpOnly `customer_session`
  cookie. The app holds it in a persistent cookie jar; a 401 anywhere signs
  the app out.
- **Checkout prices twice.** A running total is quoted without the address
  (no map pin needed). At *Place order* it is quoted again with the full
  address and pin, which returns the `draftId` the order is placed against.
