import 'package:equatable/equatable.dart';

/// One category tile as the shop drew it: its own name and picture for the
/// tile (which may differ from the category's), and a price line when set.
class HomeCategoryTile extends Equatable {
  const HomeCategoryTile({
    required this.slug,
    required this.name,
    this.imageUrl = '',
    this.priceLabel,
  });

  final String slug;
  final String name;
  final String imageUrl;

  /// "From ₹499", when the band shows prices.
  final String? priceLabel;

  @override
  List<Object?> get props => [slug, name, imageUrl, priceLabel];
}
