import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/widgets/section_header.dart';
import '../../domain/entities/product_rail.dart';
import '../../domain/entities/rail_kind.dart';
import 'product_card.dart';

/// A titled, horizontally scrolling row of products.
class ProductRailView extends StatelessWidget {
  const ProductRailView({super.key, required this.rail});

  /// Narrow enough that a third card peeks in at the edge of a phone, so the
  /// row reads as "there is more this way". Two full-width cards did not.
  static const double cardWidth = 140;

  final ProductRail rail;

  String get _title => switch (rail.kind) {
    RailKind.collection => rail.group?.name ?? '',
    RailKind.bestSellers => CatalogStrings.bestSellers,
    RailKind.trending => CatalogStrings.trending,
  };

  @override
  Widget build(BuildContext context) {
    final group = rail.group;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          title: _title,
          onViewAll: group == null
              ? null
              : () => context.push(AppRoutes.group(group.kind.path, group.slug)),
        ),
        SizedBox(
          height: cardWidth + MediaQuery.textScalerOf(context).scale(ProductCard.textBlockHeight),
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            itemCount: rail.products.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
            itemBuilder: (_, index) => SizedBox(
              width: cardWidth,
              child: ProductCard(product: rail.products[index]),
            ),
          ),
        ),
      ],
    );
  }
}
