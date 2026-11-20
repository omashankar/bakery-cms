import 'home_section.dart';

/// A row of products: a category, best sellers, trending, photo cakes...
class ProductsSection extends HomeSection {
  const ProductsSection({
    required super.id,
    required this.productSlugs,
    super.tone,
    super.overline,
    super.title,
    super.description,
    super.cta,
  });

  /// Exactly the cards the website shows, in its order.
  final List<String> productSlugs;

  @override
  List<Object?> get props => [...sectionProps, productSlugs];
}
