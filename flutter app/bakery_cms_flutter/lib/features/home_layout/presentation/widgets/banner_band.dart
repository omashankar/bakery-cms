import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../domain/entities/banner_layout.dart';
import '../../domain/entities/banners_section.dart';
import '../../domain/entities/home_banner.dart';
import '../../domain/services/home_catalog_index.dart';
import '../utils/link_opener.dart';
import '../utils/storefront_link.dart';

/// The shop's promo pictures: a two-column grid, or a sideways strip. Each
/// picture keeps the box and the width the website gives it on a phone.
class BannerBand extends StatelessWidget {
  const BannerBand({super.key, required this.section, required this.index});

  static const int gridColumns = 2;

  /// A strip of several shows most of one banner and a peek of the next.
  static const double stripItemFraction = 0.88;

  final BannersSection section;
  final HomeCatalogIndex index;

  /// The box for a banner the website gave no size: square tiles in a grid,
  /// a wide strip otherwise.
  double _aspectOf(HomeBanner banner) =>
      banner.aspectRatio ?? (section.layout == BannerLayout.strip ? 2 : 1);

  @override
  Widget build(BuildContext context) {
    final items = section.items;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final full = constraints.maxWidth;
          if (section.layout == BannerLayout.strip && items.length > 1) {
            final width = full * stripItemFraction;
            final aspect = _aspectOf(items.first);
            return SizedBox(
              height: width / aspect + _BannerTile.captionHeight(context, items),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                clipBehavior: Clip.none,
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
                itemBuilder: (_, i) => SizedBox(
                  width: width,
                  child: _BannerTile(banner: items[i], aspect: aspect, index: index),
                ),
              ),
            );
          }
          final half = (full - AppSpacing.md) / gridColumns;
          return Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.md,
            children: [
              for (final banner in items)
                SizedBox(
                  // A lone banner, a strip's single banner, or one the shop
                  // set to two columns runs the full width.
                  width: banner.isFullWidth || items.length == 1 ? full : half,
                  child: _BannerTile(banner: banner, aspect: _aspectOf(banner), index: index),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _BannerTile extends StatelessWidget {
  const _BannerTile({required this.banner, required this.aspect, required this.index});

  final HomeBanner banner;
  final double aspect;
  final HomeCatalogIndex index;

  /// Room under a strip's pictures for a caption, when any banner has one.
  static double captionHeight(BuildContext context, List<HomeBanner> items) {
    final captioned = items.any((b) => b.title != null || b.ctaLabel != null);
    if (!captioned) return 0;
    return MediaQuery.textScalerOf(context).scale(AppSpacing.xxxl + AppSpacing.sm);
  }

  @override
  Widget build(BuildContext context) {
    final route = StorefrontLink.route(banner.href, index);
    final title = banner.title;
    final action = banner.ctaLabel;
    return Semantics(
      image: true,
      label: banner.imageAlt ?? title,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        onTap: route == null ? null : () => LinkOpener.open(context, route),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            AspectRatio(
              aspectRatio: aspect,
              child: AppNetworkImage(
                url: banner.phoneImageUrl,
                displayWidth: banner.isFullWidth
                    ? AppNetworkImage.fullWidth
                    : AppNetworkImage.thumbnailWidth * 2,
                borderRadius: AppSpacing.radiusMd,
              ),
            ),
            if (title != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.xs),
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.titleSmall,
                ),
              ),
            if (action != null && route != null)
              Text(
                action,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.labelMedium?.copyWith(color: context.colors.primary),
              ),
          ],
        ),
      ),
    );
  }
}
