import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/constants/strings/listing_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../../core/widgets/failure_snackbar_listener.dart';
import '../../../../core/widgets/state_view.dart';
import '../bloc/categories/categories_cubit.dart';
import '../bloc/categories/categories_state.dart';
import '../widgets/categories_promo_banner.dart';
import '../widgets/group_grid_section.dart';

/// The Categories tab: the home page's promo picture when the app already
/// has it, then the shop's categories as square tiles, its occasions and
/// collections as larger cards.
class CategoriesPage extends StatelessWidget {
  const CategoriesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.I<CategoriesCubit>()..load(),
      child: const _CategoriesView(),
    );
  }
}

class _CategoriesView extends StatelessWidget {
  const _CategoriesView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Not "Categories": the first section below is already called that.
      appBar: const AppAppBar(title: CatalogStrings.browseTitle),
      body: FailureSnackbarListener<CategoriesCubit, CategoriesState>(
        statusOf: (s) => s.status,
        messageOf: (s) => s.errorMessage,
        hasContent: (s) => !s.isEmpty,
        child: BlocBuilder<CategoriesCubit, CategoriesState>(
          builder: (context, state) => StateView(
            status: state.status,
            isEmpty: state.isEmpty,
            errorMessage: state.errorMessage,
            onRetry: () => context.read<CategoriesCubit>().load(forceRefresh: true),
            empty: const EmptyView(
              icon: Icons.category_outlined,
              title: CatalogStrings.noCategories,
            ),
            builder: (_) {
              final catalog = state.catalog;
              final promo = state.promo;
              return RefreshIndicator(
                onRefresh: () => context.read<CategoriesCubit>().load(forceRefresh: true),
                child: CustomScrollView(
                  slivers: [
                    if (promo != null)
                      SliverToBoxAdapter(
                        child: CategoriesPromoBanner(banner: promo, catalog: catalog),
                      ),
                    GroupGridSection.tiles(
                      title: ListingStrings.categoriesHeading,
                      groups: catalog.categories,
                    ),
                    GroupGridSection.cards(
                      title: ListingStrings.occasionsHeading,
                      groups: catalog.occasions,
                    ),
                    GroupGridSection.cards(
                      title: ListingStrings.collectionsHeading,
                      groups: catalog.collections,
                    ),
                    const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xl)),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
