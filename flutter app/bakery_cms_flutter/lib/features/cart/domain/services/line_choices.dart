import '../../../../core/constants/strings/cart_strings.dart';

/// A line's choices in the customer's words, every value labelled: the
/// website's `cartLineChoices` (`features/cart/lib/cart.ts`), which the cart,
/// the checkout summary and the order pages all read.
///
/// "Size: 1 Kg · Flavour: Chocolate · Egg preference: Eggless", never a bare
/// "1 Kg · Chocolate": on anything but a cake a bare value says nothing about
/// which choice it is. The size is headed with the shop's own word for it
/// ([weightLabel]), or "Size" when the shop named none.
abstract final class LineChoices {
  static List<String> of({
    String? weight,
    String? weightLabel,
    String? flavour,
    String? shape,
    List<String> variantSummary = const [],
  }) {
    final sizeLabel = (weightLabel ?? '').trim().isEmpty
        ? CartStrings.sizeLabel
        : weightLabel!.trim();
    final labelled = [
      (sizeLabel, weight),
      (CartStrings.flavourLabel, flavour),
      (CartStrings.shapeLabel, shape),
    ];
    return [
      for (final (label, value) in labelled)
        if (value != null && value.trim().isNotEmpty) '$label: $value',
      for (final line in variantSummary)
        if (line.trim().isNotEmpty) line,
    ];
  }
}
