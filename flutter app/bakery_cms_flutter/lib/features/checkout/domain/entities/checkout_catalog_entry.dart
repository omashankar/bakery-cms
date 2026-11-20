import 'package:equatable/equatable.dart';

import '../../../orders/domain/entities/cancellation_class.dart';

/// What checkout needs to know about one live product: the website's
/// `CheckoutCatalogEntry` (checkout-page.tsx), read when checkout opens, so
/// it is the shop's word now and not what the cart line remembered.
class CheckoutCatalogEntry extends Equatable {
  const CheckoutCatalogEntry({
    required this.slug,
    this.codAllowed = true,
    this.cancellationClass = CancellationClass.standard,
    this.occasions = const [],
    this.categoryIds = const [],
  });

  final String slug;

  /// The shop's own toggle, on unless switched off (`productAllowsCod`).
  final bool codAllowed;
  final CancellationClass cancellationClass;

  /// The occasion names this product is tagged with.
  final List<String> occasions;

  /// Every category the product is filed under, as the shop has it now.
  final List<String> categoryIds;

  @override
  List<Object?> get props => [slug, codAllowed, cancellationClass, occasions, categoryIds];
}
