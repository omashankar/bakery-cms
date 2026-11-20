import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/product_group.dart';
import 'group_picture_tile.dart';

/// A small capitals heading ("CATEGORIES") over a grid of group pictures,
/// for a `CustomScrollView`. Draws nothing without [groups].
///
/// [GroupGridSection.tiles] is the dense grid of square tiles (four across on
/// a phone); [GroupGridSection.cards] the roomier one of larger pictures (two
/// across). Wider screens fit more columns, never fewer.
class GroupGridSection extends StatelessWidget {
  const GroupGridSection.tiles({super.key, required this.title, required this.groups})
    : minColumns = tileColumns,
      maxTileWidth = AppSpacing.categoryTileSize * 2,
      imageAspect = AppSpacing.groupTileImageAspect,
      nameLines = 2,
      large = false;

  const GroupGridSection.cards({super.key, required this.title, required this.groups})
    : minColumns = cardColumns,
      maxTileWidth = AppSpacing.productGridMaxExtent,
      imageAspect = AppSpacing.groupCardImageAspect,
      nameLines = 1,
      large = true;

  final String title;
  final List<ProductGroup> groups;
  final int minColumns;
  final double maxTileWidth;
  final double imageAspect;
  final int nameLines;
  final bool large;

  /// Across a phone: four square tiles, two larger cards.
  static const int tileColumns = 4;
  static const int cardColumns = 2;

  static const double _spacing = AppSpacing.md;

  @override
  Widget build(BuildContext context) {
    if (groups.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
    final nameStyle = large ? context.text.bodyMedium : context.text.bodySmall;
    // The name's own lines at the reader's text size, so large text never
    // pushes a name out of its cell.
    final fontSize = nameStyle?.fontSize ?? AppSpacing.lg;
    final lineHeight = MediaQuery.textScalerOf(context).scale(fontSize) * (nameStyle?.height ?? 1);
    final nameHeight = lineHeight * nameLines + AppSpacing.xs + AppSpacing.xxs;
    return SliverMainAxisGroup(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.xl,
              AppSpacing.lg,
              AppSpacing.md,
            ),
            child: Text(
              title,
              style: context.text.titleSmall?.copyWith(color: context.colors.onSurfaceVariant),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          sliver: SliverLayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.crossAxisExtent;
              final columns = math.max(minColumns, (width / maxTileWidth).floor());
              final columnWidth = (width - _spacing * (columns - 1)) / columns;
              return SliverGrid.builder(
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: columns,
                  crossAxisSpacing: _spacing,
                  mainAxisSpacing: _spacing,
                  mainAxisExtent: columnWidth / imageAspect + nameHeight,
                ),
                itemCount: groups.length,
                itemBuilder: (_, index) => GroupPictureTile(
                  group: groups[index],
                  imageAspect: imageAspect,
                  nameLines: nameLines,
                  nameStyle: nameStyle,
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
