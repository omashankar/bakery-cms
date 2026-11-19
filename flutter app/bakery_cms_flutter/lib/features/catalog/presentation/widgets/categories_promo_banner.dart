import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../../../core/widgets/natural_aspect_image.dart';
import '../../../home_layout/domain/entities/home_banner.dart';
import '../../../home_layout/domain/services/home_catalog_index.dart';
import '../../../home_layout/presentation/utils/link_opener.dart';
import '../../../home_layout/presentation/utils/storefront_link.dart';
import '../../domain/entities/catalog.dart';

/// The home page's promo picture at the top of the Categories tab, opening
/// what the shop linked it to. Not tappable when the app has no screen for
/// that link.
class CategoriesPromoBanner extends StatelessWidget {
  const CategoriesPromoBanner({super.key, required this.banner, required this.catalog});

  final HomeBanner banner;

  /// Resolves a link to a category or occasion; a link to a product needs no
  /// lookup, so no products are passed.
  final Catalog catalog;

  @override
  Widget build(BuildContext context) {
    final route = StorefrontLink.route(
      banner.href,
      HomeCatalogIndex(products: const [], catalog: catalog),
    );
    // The banner's own box when the shop's layout gives one; a hero slide
    // carries none, so its picture sets the shape (whole, never cropped).
    final known = banner.aspectRatio;
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, 0),
      child: Semantics(
        image: true,
        label: banner.imageAlt ?? banner.title,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          onTap: route == null ? null : () => LinkOpener.open(context, route),
          child: known != null
              ? AspectRatio(
                  aspectRatio: known.clamp(
                    AppSpacing.promoBannerMinAspect,
                    AppSpacing.promoBannerMaxAspect,
                  ),
                  child: AppNetworkImage(
                    url: banner.phoneImageUrl,
                    displayWidth: AppNetworkImage.fullWidth,
                    borderRadius: AppSpacing.radiusMd,
                  ),
                )
              : NaturalAspectImage(
                  url: banner.phoneImageUrl,
                  fallbackAspect: AppSpacing.promoBannerAspect,
                  minAspect: AppSpacing.promoBannerMinAspect,
                  maxAspect: AppSpacing.promoBannerMaxAspect,
                  borderRadius: AppSpacing.radiusMd,
                ),
        ),
      ),
    );
  }
}
