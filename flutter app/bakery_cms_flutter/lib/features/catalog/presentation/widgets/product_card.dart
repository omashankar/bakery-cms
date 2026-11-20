import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../../delivery_area/presentation/widgets/earliest_delivery_text.dart';
import '../../../store/presentation/bloc/store_config_cubit.dart';
import '../../../store/presentation/widgets/shop_price.dart';
import '../../../wishlist/presentation/widgets/wishlist_heart_button.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/product_modules.dart';
import '../utils/product_modules_reader.dart';
import 'rating_badge.dart';
import 'stock_badge.dart';

/// A product in a grid or rail: the square photo with the wishlist heart
/// over it, the name, the price and the earliest delivery day. Names are
/// plain, never bold, as on the website.
///
/// Reads the app-wide `StoreConfigCubit`, `WishlistCubit` and
/// `DeliveryAreaCubit`.
class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product});

  /// Everything under the square image at normal text size: the gap, a
  /// two-line name (2 × 20), the gap, the price row (20), the gap and the
  /// earliest-delivery line (16), with a little to spare. Grids and rails size
  /// their cells from this, scaled by the reader's text size.
  ///
  /// The rating sits over the photo, not under it, so a card with reviews and
  /// one without are the same height and no row keeps an empty line for it.
  static const double textBlockHeight = 96;

  final Product product;

  @override
  Widget build(BuildContext context) {
    final small = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    // A module the shop switched off is not priced, so the card does not
    // show its surcharge either (the website's `toCard`).
    final modules = context.select<StoreConfigCubit, ProductModules>(
      (cubit) => ProductModulesReader.of(cubit.state.config),
    );
    return InkWell(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      onTap: () => context.push(AppRoutes.product(product.slug)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: AppSpacing.productCardImageAspect,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppNetworkImage(url: product.image, borderRadius: AppSpacing.radiusMd),
                if (!product.isAvailable)
                  const Positioned(
                    left: AppSpacing.sm,
                    top: AppSpacing.sm,
                    child: StockBadge(label: CatalogStrings.outOfStock),
                  ),
                // Its own tap target, so a tap on the heart saves the product
                // and never opens it.
                Positioned(top: 0, right: 0, child: WishlistHeartButton(productSlug: product.slug)),
                if (product.reviewCount > 0)
                  Positioned(
                    left: AppSpacing.sm,
                    right: AppSpacing.sm,
                    bottom: AppSpacing.sm,
                    // Shrunk, never wrapped, on the narrowest card.
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: RatingBadge(
                          rating: product.rating,
                          reviewCount: product.reviewCount,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            product.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: context.text.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.xs),
          // The website's card: the first weight's price with the default
          // options, the "was" price and the discount. The same three numbers
          // a customer sees on the site, so the two never disagree.
          // One line, shrunk to fit a narrow card: [textBlockHeight] has room
          // for one price row, and a wrapped one would spill out of the cell.
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: ShopPrice(
              amount: product.cardPriceWith(modules),
              compareAt: product.cardCompareAtWith(modules),
              showPercentOff: true,
              style: context.text.titleSmall,
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          // One line as well, for the same reason. Nothing until the shop's
          // settings are in.
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: EarliestDeliveryText(style: small),
          ),
        ],
      ),
    );
  }
}
