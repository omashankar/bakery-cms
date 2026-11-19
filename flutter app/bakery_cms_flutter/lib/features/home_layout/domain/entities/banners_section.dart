import 'banner_layout.dart';
import 'home_banner.dart';
import 'home_section.dart';

/// A band of the shop's promo pictures.
class BannersSection extends HomeSection {
  const BannersSection({
    required super.id,
    required this.layout,
    required this.items,
    this.shape,
    super.tone,
    super.overline,
    super.title,
    super.description,
    super.cta,
  });

  final BannerLayout layout;
  final List<HomeBanner> items;

  /// The website's tile shape setting (`square`, `wide`, ...), when set.
  final String? shape;

  @override
  List<Object?> get props => [...sectionProps, layout, items, shape];
}
