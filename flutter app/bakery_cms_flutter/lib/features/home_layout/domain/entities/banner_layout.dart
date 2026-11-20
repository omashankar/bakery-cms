/// How a band of banners is laid out: tiles side by side, or a scrolling strip.
enum BannerLayout {
  grid('grid'),
  strip('strip');

  const BannerLayout(this.apiValue);

  final String apiValue;

  static BannerLayout fromApi(Object? value) =>
      value == strip.apiValue ? BannerLayout.strip : BannerLayout.grid;
}
