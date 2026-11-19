import 'package:equatable/equatable.dart';

import '../../../cart/domain/entities/cart_item.dart';
import '../../../offers/domain/entities/offer_cart_line.dart';
import '../../../orders/domain/entities/cancellation_class.dart';
import 'checkout_catalog_entry.dart';

/// The shop's published products, as checkout reads them (see
/// [CheckoutCatalogEntry]), with the rules the website derives from them in
/// checkout-page.tsx.
class CheckoutCatalog extends Equatable {
  const CheckoutCatalog(this.entries);

  /// Slug → entry.
  final Map<String, CheckoutCatalogEntry> entries;

  /// The cart lines that take no cash, by name: the website's `codBlockedBy`.
  /// A product the catalogue does not list blocks nothing (the server
  /// refuses it on its own).
  List<String> codBlockedBy(List<CartItem> items) => [
    for (final item in items)
      if (entries[item.productSlug]?.codAllowed == false) item.name,
  ];

  /// The cart as a coupon sees it, one line each with every category its
  /// product is filed under now: the website's `couponLines`. A scoped
  /// coupon ("20% off plants") then takes its share of the plants alone. A
  /// product the catalogue does not list is in no category, as there.
  ///
  /// A preview only: the shop re-derives the discount when it prices.
  List<OfferCartLine> offerLines(List<CartItem> items) => [
    for (final item in items)
      OfferCartLine(
        price: item.unitPrice,
        quantity: item.quantity,
        categoryIds: entries[item.productSlug]?.categoryIds ?? const [],
      ),
  ];

  /// Every occasion the shop tagged any product with, once each, sorted:
  /// the website's `occasionOptions`. Empty means the shop asks nothing.
  List<String> get occasionOptions {
    final seen = <String, String>{};
    for (final entry in entries.values) {
      for (final name in entry.occasions) {
        final clean = name.trim();
        if (clean.isNotEmpty) seen[clean.toLowerCase()] = clean;
      }
    }
    return seen.values.toList()..sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
  }

  /// Each kind of cancellation rule in this cart, strictest first: the
  /// website's `cartPolicyClasses`. A product not listed reads as standard.
  List<CancellationClass> policyClasses(List<CartItem> items) {
    final present = {
      for (final item in items)
        entries[item.productSlug]?.cancellationClass ?? CancellationClass.standard,
    };
    return const [
      CancellationClass.nonCancellable,
      CancellationClass.madeToOrder,
      CancellationClass.standard,
    ].where(present.contains).toList();
  }

  @override
  List<Object?> get props => [entries];
}
