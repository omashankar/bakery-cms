import 'package:equatable/equatable.dart';

class VariantOption extends Equatable {
  const VariantOption({
    required this.id,
    required this.label,
    required this.priceAdjustment,
    this.isDefault = false,
  });

  final String id;
  final String label;

  /// Added to the unit price when chosen; may be zero.
  final double priceAdjustment;
  final bool isDefault;

  @override
  List<Object?> get props => [id, label, priceAdjustment, isDefault];
}
