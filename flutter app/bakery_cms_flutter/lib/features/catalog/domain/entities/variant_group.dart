import 'package:equatable/equatable.dart';

import 'variant_option.dart';

/// A choice the shop defined on the product ("Base": Egg / Eggless).
class VariantGroup extends Equatable {
  const VariantGroup({
    required this.id,
    required this.name,
    required this.required,
    required this.options,
    this.type = custom,
  });

  /// The one typed group left on the website (`ProductVariantGroupType`):
  /// the Shape module hides it, and the shop stops charging for it.
  static const String shape = 'shape';
  static const String custom = 'custom';

  final String id;
  final String name;
  final bool required;
  final List<VariantOption> options;

  /// [shape] or [custom].
  final String type;

  bool get isShape => type == shape;

  /// The option the shop answers for the customer: the one marked default,
  /// and only that. The website's rule (`getDefaultVariantSelections` and
  /// `calculateVariantAdjustment`): a group that names no default starts with
  /// nothing chosen and adds nothing to the price, required or not.
  VariantOption? get defaultOption {
    for (final option in options) {
      if (option.isDefault) return option;
    }
    return null;
  }

  VariantOption? optionById(String? id) {
    for (final option in options) {
      if (option.id == id) return option;
    }
    return null;
  }

  /// What the line is charged for in this group: the chosen option, else the
  /// default (the website's `calculateVariantAdjustment`).
  VariantOption? chargedOption(String? selectedId) => optionById(selectedId) ?? defaultOption;

  @override
  List<Object?> get props => [id, name, required, options, type];
}
