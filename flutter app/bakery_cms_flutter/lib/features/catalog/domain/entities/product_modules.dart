import 'package:equatable/equatable.dart';

/// The shop's optional product modules that change what a product page
/// offers and what a line is charged (`settings.modules` on the website).
///
/// Every module is ON unless the shop switched it off, exactly as the
/// website reads it (`{ ...defaultModuleSettings, ...settings.modules }`):
/// only an explicit `false` hides anything.
///
/// - [weight] off: no size picker, the first size is priced, and the line
///   carries no size label (`product-detail-page.tsx` `modules.weight`).
/// - [shape] off: every variant group of type `shape` is hidden AND not
///   priced (`variantGroupsEnabledBy` in `variant-utils.ts`, which the
///   server's `priceLine` also runs).
/// - [photoCake] off: no "Add your photo", and no photo on the line
///   (`showPhotoUpload` on the product page).
///
/// The website's `flavour` module gates nothing any more: the flavour picker
/// it hid was removed (flavours are variant groups now), so it is not here.
class ProductModules extends Equatable {
  const ProductModules({this.weight = true, this.shape = true, this.photoCake = true});

  /// A shop that has switched nothing off.
  static const ProductModules all = ProductModules();

  final bool weight;
  final bool shape;
  final bool photoCake;

  @override
  List<Object?> get props => [weight, shape, photoCake];
}
