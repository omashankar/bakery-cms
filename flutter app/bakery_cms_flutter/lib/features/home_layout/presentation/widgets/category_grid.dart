import 'package:flutter/material.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../domain/entities/home_category_tile.dart';
import '../../domain/services/home_catalog_index.dart';
import '../utils/link_opener.dart';

/// Category tiles four to a row: a round picture, the name, and a price line
/// when the shop shows one.
class CategoryGrid extends StatelessWidget {
  const CategoryGrid({super.key, required this.tiles, required this.index});

  static const int perRow = 4;

  final List<HomeCategoryTile> tiles;
  final HomeCatalogIndex index;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth / perRow;
          return Wrap(
            runSpacing: AppSpacing.md,
            children: [
              for (final tile in tiles)
                SizedBox(
                  width: width,
                  child: _Tile(tile: tile, index: index),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.tile, required this.index});

  final HomeCategoryTile tile;
  final HomeCatalogIndex index;

  @override
  Widget build(BuildContext context) {
    final group = index.group(tile.slug);
    final priceLabel = tile.priceLabel;
    return InkWell(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      onTap: group == null
          ? null
          : () => LinkOpener.open(context, AppRoutes.group(group.kind.path, group.slug)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
        child: Column(
          children: [
            SizedBox.square(
              dimension: AppSpacing.categoryTileSize,
              child: AppNetworkImage(
                url: tile.imageUrl,
                displayWidth: AppNetworkImage.thumbnailWidth,
                borderRadius: AppSpacing.radiusPill,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              tile.name,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: context.text.bodySmall,
            ),
            if (priceLabel != null)
              Text(
                priceLabel,
                maxLines: 1,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: context.text.labelSmall?.copyWith(color: context.colors.onSurfaceVariant),
              ),
          ],
        ),
      ),
    );
  }
}
