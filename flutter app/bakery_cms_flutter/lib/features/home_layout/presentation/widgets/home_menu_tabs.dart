import 'package:flutter/material.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../domain/entities/home_menu_item.dart';
import '../../domain/services/home_catalog_index.dart';
import '../utils/link_opener.dart';
import '../utils/storefront_link.dart';

/// The shop's website header menu as a row of icon tabs under the search
/// box: a round picture (or an icon when the item has none) over its name,
/// scrolling sideways. Draws nothing when the menu is empty.
class HomeMenuTabs extends StatelessWidget {
  const HomeMenuTabs({super.key, required this.items, required this.index});

  final List<HomeMenuItem> items;

  /// For the groups the items link to.
  final HomeCatalogIndex index;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(AppSpacing.sm, AppSpacing.md, AppSpacing.sm, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [for (final item in items) _Tab(item: item, index: index)],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.item, required this.index});

  final HomeMenuItem item;
  final HomeCatalogIndex index;

  @override
  Widget build(BuildContext context) {
    final route = StorefrontLink.route(item.href, index);
    return SizedBox(
      width: AppSpacing.categoryTileSize,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        onTap: route == null ? null : () => LinkOpener.open(context, route),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxs),
          child: Column(
            children: [
              SizedBox.square(
                dimension: AppSpacing.thumbnailSize,
                child: item.imageUrl.isEmpty
                    ? _IconCircle(icon: _iconFor(route))
                    : AppNetworkImage(
                        url: item.imageUrl,
                        displayWidth: AppNetworkImage.thumbnailWidth,
                        borderRadius: AppSpacing.radiusPill,
                      ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                item.label,
                maxLines: 2,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: context.text.labelSmall,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// An icon that says where the item goes, for a menu item with no picture.
  static IconData _iconFor(String? route) => switch (route) {
    AppRoutes.categories => Icons.grid_view_rounded,
    AppRoutes.cart => Icons.shopping_bag_outlined,
    final String r when r.startsWith(AppRoutes.search) => Icons.search,
    _ => Icons.local_offer_outlined,
  };
}

class _IconCircle extends StatelessWidget {
  const _IconCircle({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerHighest,
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: context.colors.primary, size: AppSpacing.iconMd),
    );
  }
}
