import 'home_banner.dart';
import 'home_section.dart';

/// The slider at the top of the page.
class HeroSection extends HomeSection {
  const HeroSection({
    required super.id,
    required this.slides,
    super.tone,
    super.overline,
    super.title,
    super.description,
    super.cta,
  });

  final List<HomeBanner> slides;

  @override
  List<Object?> get props => [...sectionProps, slides];
}
