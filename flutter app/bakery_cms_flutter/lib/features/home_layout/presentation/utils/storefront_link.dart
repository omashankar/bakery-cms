import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/api_endpoints.dart';
import '../../../catalog/domain/entities/group_kind.dart';
import '../../domain/services/home_catalog_index.dart';

/// The app screen behind a website address the shop typed into its Homepage
/// Builder ("/store/collections/cakes", "/store/p/red-velvet", ...).
abstract final class StorefrontLink {
  static const String _store = 'store';

  /// The app route for [href], or null when the app has no screen for it
  /// (a page of the website only, or another site altogether).
  static String? route(String? href, HomeCatalogIndex index, {String? base}) {
    final raw = href?.trim() ?? '';
    if (raw.isEmpty) return null;
    final uri = Uri.tryParse(raw);
    if (uri == null) return null;
    if (uri.hasScheme || uri.host.isNotEmpty) {
      final shop = Uri.tryParse(base ?? ApiEndpoints.baseUrl);
      // Another site: the app does not open browsers for it.
      if (shop == null || uri.host != shop.host) return null;
    }

    final query = uri.queryParameters['q']?.trim() ?? '';
    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    final path = segments.isNotEmpty && segments.first == _store ? segments.sublist(1) : segments;

    if (path.isEmpty) return query.isNotEmpty ? AppRoutes.searchFor(query) : AppRoutes.home;
    final slug = path.length > 1 ? path[1] : null;
    switch (path.first) {
      case 'p':
        return slug == null ? null : AppRoutes.product(slug);
      case 'collections':
        if (slug == null) {
          return query.isNotEmpty ? AppRoutes.searchFor(query) : AppRoutes.categories;
        }
        return _group(index, slug, null);
      case 'occasions':
        return slug == null ? AppRoutes.categories : _group(index, slug, GroupKind.occasion);
      case 'departments':
        return AppRoutes.categories;
      case 'cart':
        return AppRoutes.cart;
      case 'search':
        return query.isEmpty ? AppRoutes.search : AppRoutes.searchFor(query);
      default:
        return query.isNotEmpty ? AppRoutes.searchFor(query) : null;
    }
  }

  static String? _group(HomeCatalogIndex index, String slug, GroupKind? kind) {
    final group = index.group(slug, kind: kind);
    return group == null ? null : AppRoutes.group(group.kind.path, group.slug);
  }
}
