/// One spacing scale for the whole app. Never write a raw padding number in a
/// widget — pick the step from here.
abstract final class AppSpacing {
  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 48;

  static const double radiusSm = 8;
  static const double radiusMd = 12;
  static const double radiusLg = 16;
  static const double radiusPill = 999;

  static const double buttonHeight = 48;

  /// Material's own minimum. Never `Size.fromHeight` (infinite width): a
  /// button in a Row then has no width it can take and the whole page fails
  /// to lay out. `AppButton(expand: true)` is how a button goes full width.
  static const double buttonMinWidth = 64;
  static const double iconSm = 16;
  static const double iconMd = 24;
  static const double iconLg = 48;
  static const double iconXl = 72;
  static const double loaderSize = 28;
  static const double loaderStroke = 2.5;
  static const double borderWidth = 1;

  static const double productCardImageAspect = 1;
  static const double productGridMaxExtent = 220;
  static const double categoryTileSize = 72;
  static const double groupTileImageAspect = 1;
  static const double groupCardImageAspect = 4 / 3;

  /// The promo picture on the Categories tab, when the shop gave it no shape
  /// of its own (the website's hero box), and the narrowest and widest it is
  /// drawn: a square banner would push the groups off the screen.
  static const double promoBannerAspect = 3;
  static const double promoBannerMinAspect = 2;
  static const double promoBannerMaxAspect = 4;
  static const double thumbnailSize = 64;
  static const double mapHeight = 360;
  static const double maxContentWidth = 720;
}
