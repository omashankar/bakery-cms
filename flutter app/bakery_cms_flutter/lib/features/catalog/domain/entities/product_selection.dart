import 'package:equatable/equatable.dart';

import '../../../cart/domain/entities/cart_item.dart';
import 'product.dart';
import 'product_modules.dart';
import 'product_weight.dart';
import 'variant_group.dart';

/// What the customer has chosen on a product page, and the cart line it
/// becomes. Mirrors the website's product page (`product-detail-page.tsx`):
/// the same defaults, the same module gates, the same price and the same
/// struck-through price for every size and option.
class ProductSelection extends Equatable {
  const ProductSelection({
    required this.product,
    this.weight,
    this.message = '',
    this.photoUrl,
    this.variantSelections = const {},
    this.quantity = 1,
    this.modules = ProductModules.all,
  });

  /// The product's defaults: the first size and each variant group's default
  /// option (`getDefaultVariantSelections`). Nothing else is pre-chosen: the
  /// legacy `flavourOptions`/`shapes` lists are not offered at all, as on
  /// the website.
  factory ProductSelection.initial(
    Product product, {
    ProductModules modules = ProductModules.all,
  }) => ProductSelection(
    product: product,
    weight: product.weights.firstOrNull,
    variantSelections: {
      for (final group in product.variantGroups)
        if (group.defaultOption case final option?) group.id: option.id,
    },
    modules: modules,
  );

  static const int maxMessageLength = 500;

  final Product product;
  final ProductWeight? weight;
  final String message;

  /// The shop's URL for the customer's uploaded photo (photo cakes only).
  final String? photoUrl;

  /// Group id → option id, for every group (also the hidden ones, so turning
  /// a module back on restores the choice); [visibleSelections] is what is
  /// priced and sent.
  final Map<String, String> variantSelections;
  final int quantity;

  /// What the shop has switched on. Decides what is offered and charged.
  final ProductModules modules;

  /// The groups the customer is shown and charged for.
  List<VariantGroup> get visibleGroups => product.groupsEnabledBy(modules);

  /// Only what the customer could see, and only what the shop will charge.
  Map<String, String> get visibleSelections {
    final allowed = {for (final group in visibleGroups) group.id};
    return {
      for (final entry in variantSelections.entries)
        if (allowed.contains(entry.key)) entry.key: entry.value,
    };
  }

  /// The size picker: shown whenever the product has sizes and the Weight
  /// module is on, even for one size (the website's `OptionGroup` hides only
  /// an empty list).
  bool get offersWeights => modules.weight && product.hasWeights;

  /// "Add your photo": a photo product in a shop with Photo Cake on.
  bool get offersPhoto => product.allowsPhotoUpload && modules.photoCake;

  /// The size that is priced: the chosen one, or the first when the picker is
  /// hidden (the website keeps `selectedWeight` at 0 then).
  ProductWeight? get pricedWeight => modules.weight ? weight : product.weights.firstOrNull;

  double get unitPrice =>
      product.unitPriceFor(weight: pricedWeight, selections: visibleSelections, modules: modules);
  double get lineTotal => unitPrice * quantity;

  /// The struck-through price for THIS size and these options, moved by
  /// whatever moved [unitPrice] (`displayCompareAtPrice`).
  double? get compareAt => product.displayCompareAt(unitPrice);

  /// Every required choice has been made. The website asks for nothing
  /// beyond a size, and a size is always pre-chosen.
  bool get isComplete => !product.hasWeights || pricedWeight != null;

  bool get canAddToCart => product.isAvailable && isComplete;

  /// The readable lines for the chosen options, as the website writes them
  /// (`formatVariantSummary`): "Name: Option", or the option alone when the
  /// group is named after it; a group with no choice and no default says
  /// nothing.
  List<String> get variantSummary => [
    for (final group in visibleGroups) ?_summaryLine(group, visibleSelections[group.id]),
  ];

  static String? _summaryLine(VariantGroup group, String? selectedId) {
    final option = group.chargedOption(selectedId);
    if (option == null) return null;
    final name = group.name.trim();
    final label = option.label.trim();
    if (name.isEmpty || name.toLowerCase() == label.toLowerCase()) return label;
    return '$name: $label';
  }

  CartItem toCartItem() {
    final trimmedMessage = message.trim();
    final note = trimmedMessage.isEmpty || !product.allowsMessage ? null : trimmedMessage;
    // No size label when the Weight module is off: the website sends none,
    // and the server then prices the first size.
    final sizeLabel = modules.weight ? weight?.label : null;
    final photo = offersPhoto ? photoUrl : null;
    final selections = visibleSelections;
    return CartItem(
      id: CartItem.keyFor(
        productSlug: product.slug,
        weight: sizeLabel,
        message: note,
        photoUrl: photo,
        variantSelections: selections,
      ),
      productSlug: product.slug,
      name: product.name,
      image: product.image,
      unitPrice: unitPrice,
      compareAtPrice: compareAt,
      quantity: quantity,
      weight: sizeLabel,
      weightLabel: sizeLabel == null ? null : product.weightLabel,
      message: note,
      photoUrl: photo,
      variantSelections: selections,
      variantSummary: variantSummary,
      deliveryTierIds: product.deliveryTierIds,
      codAllowed: product.codAllowed,
    );
  }

  ProductSelection copyWith({
    ProductWeight? weight,
    String? message,
    Map<String, String>? variantSelections,
    int? quantity,
    ProductModules? modules,
  }) {
    return ProductSelection(
      product: product,
      weight: weight ?? this.weight,
      message: message ?? this.message,
      photoUrl: photoUrl, // kept: withPhoto is how it changes
      variantSelections: variantSelections ?? this.variantSelections,
      quantity: quantity ?? this.quantity,
      modules: modules ?? this.modules,
    );
  }

  /// The same choices with [url] as the photo; null takes the photo off.
  /// (`copyWith` cannot say "none": a null there means "unchanged".)
  ProductSelection withPhoto(String? url) => ProductSelection(
    product: product,
    weight: weight,
    message: message,
    photoUrl: product.allowsPhotoUpload ? url : null,
    variantSelections: variantSelections,
    quantity: quantity,
    modules: modules,
  );

  @override
  List<Object?> get props => [
    product,
    weight,
    message,
    photoUrl,
    variantSelections,
    quantity,
    modules,
  ];
}
