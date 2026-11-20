import '../constants/api_endpoints.dart';

/// Image addresses as the shop stores them: absolute (a CDN), or a path on
/// the shop itself (`/uploads/banner.jpg`), which a phone cannot load alone.
abstract final class ImageUrl {
  /// [url] made loadable: a shop path gets the shop's address in front,
  /// anything else is returned as it is ("" stays "").
  static String resolve(String url, {String? base}) {
    final trimmed = url.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return trimmed;
    final origin = (base ?? ApiEndpoints.baseUrl).replaceFirst(RegExp(r'/+$'), '');
    return '$origin$trimmed';
  }
}
