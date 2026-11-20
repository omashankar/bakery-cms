import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/listing_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../store/presentation/bloc/store_config_cubit.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/product_modules.dart';
import '../../domain/services/listing_arranger.dart';
import '../bloc/listing_controls/listing_controls_cubit.dart';
import '../bloc/listing_controls/listing_controls_state.dart';
import '../utils/product_modules_reader.dart';
import 'product_sliver_grid.dart';

/// [products] in the sort and filter the customer chose, as a two-column
/// grid under an optional [title], [blurb] and the number shown. When the
/// filter leaves nothing, says so and offers to clear it.
///
/// Sorted and filtered by the price each card shows, which a module the shop
/// switched off does not add to (the website's `toCard`).
///
/// For a `CustomScrollView`; needs a [ListingControlsCubit] and the app-wide
/// `StoreConfigCubit` above it.
class ListingProductsSliver extends StatelessWidget {
  const ListingProductsSliver({super.key, required this.products, this.title, this.blurb});

  final List<Product> products;
  final String? title;

  /// A line or two about the group, cut short: the products are the page.
  final String? blurb;

  static const int blurbLines = 2;

  @override
  Widget build(BuildContext context) {
    final modules = context.select<StoreConfigCubit, ProductModules>(
      (cubit) => ProductModulesReader.of(cubit.state.config),
    );
    return BlocBuilder<ListingControlsCubit, ListingControlsState>(
      builder: (context, controls) {
        final shown = ListingArranger.arrange(
          products,
          modules: modules,
          sort: controls.sort,
          filter: controls.filter,
        );
        if (shown.isEmpty && products.isNotEmpty) {
          return SliverFillRemaining(
            hasScrollBody: false,
            child: EmptyView(
              icon: Icons.filter_alt_off_outlined,
              title: ListingStrings.noMatchesTitle,
              message: ListingStrings.noMatchesMessage,
              actionLabel: ListingStrings.clearFilters,
              onAction: () => context.read<ListingControlsCubit>().clearFilters(),
            ),
          );
        }
        return SliverMainAxisGroup(
          slivers: [
            SliverToBoxAdapter(
              child: _Header(title: title, blurb: blurb, count: shown.length),
            ),
            ProductSliverGrid(products: shown),
          ],
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.blurb, required this.count});

  final String? title;
  final String? blurb;
  final int count;

  @override
  Widget build(BuildContext context) {
    final heading = title ?? '';
    final about = blurb ?? '';
    final muted = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (heading.isNotEmpty) Text(heading, style: context.text.titleMedium),
          if (about.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xxs),
              child: Text(
                about,
                maxLines: ListingProductsSliver.blurbLines,
                overflow: TextOverflow.ellipsis,
                style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xxs),
            child: Text(ListingStrings.productCount(count), style: muted),
          ),
        ],
      ),
    );
  }
}
