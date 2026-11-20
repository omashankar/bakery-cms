import 'home_category_tile.dart';
import 'home_section.dart';

/// Category tiles, in the order the shop shows them.
class CategoriesSection extends HomeSection {
  const CategoriesSection({
    required super.id,
    required this.categorySlugs,
    this.tiles = const [],
    super.tone,
    super.overline,
    super.title,
    super.description,
    super.cta,
  });

  final List<String> categorySlugs;

  /// The tiles as the shop drew them (its own names and pictures). Empty from
  /// an older shop: the app then draws the categories it holds for
  /// [categorySlugs].
  final List<HomeCategoryTile> tiles;

  @override
  List<Object?> get props => [...sectionProps, categorySlugs, tiles];
}
