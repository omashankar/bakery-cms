import '../entities/banners_section.dart';
import '../entities/hero_section.dart';
import '../entities/home_banner.dart';
import '../entities/home_layout.dart';

/// The one promo picture another screen borrows from the home page: the
/// first picture of the first hero slider or banner band, in page order.
abstract final class PromoBannerPicker {
  static HomeBanner? pick(HomeLayout? layout) {
    if (layout == null) return null;
    for (final section in layout.sections) {
      final pictures = switch (section) {
        HeroSection(:final slides) => slides,
        BannersSection(:final items) => items,
        _ => const <HomeBanner>[],
      };
      for (final picture in pictures) {
        if (picture.phoneImageUrl.trim().isNotEmpty) return picture;
      }
    }
    return null;
  }
}
