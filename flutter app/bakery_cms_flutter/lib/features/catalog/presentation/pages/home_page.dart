import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../../core/widgets/failure_snackbar_listener.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../../core/widgets/state_view.dart';
import '../../../delivery_area/presentation/widgets/delivery_area_bar.dart';
import '../../../home_layout/domain/services/home_catalog_index.dart';
import '../../../home_layout/presentation/widgets/home_menu_tabs.dart';
import '../../../home_layout/presentation/widgets/home_section_view.dart';
import '../../../store/presentation/bloc/store_config_cubit.dart';
import '../../../store/presentation/bloc/store_config_state.dart';
import '../bloc/home/home_bloc.dart';
import '../bloc/home/home_event.dart';
import '../bloc/home/home_state.dart';
import '../../domain/entities/home_feed.dart';
import '../widgets/group_strip.dart';
import '../widgets/home_greeting.dart';
import '../widgets/product_rail_view.dart';
import '../widgets/product_sliver_grid.dart';
import '../widgets/search_entry_bar.dart';
import '../widgets/shop_title.dart';
import '../widgets/header_cart_button.dart';
import '../widgets/header_wishlist_button.dart';

/// The dashboard: browse by category and occasion, the shop's collections,
/// then everything.
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.I<HomeBloc>()..add(const HomeStarted()),
      child: const _HomeView(),
    );
  }
}

class _HomeView extends StatelessWidget {
  const _HomeView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // The shop's mark and name, then the wishlist and the cart: the home
      // page has its own search box under the header.
      appBar: const AppAppBar(
        titleWidget: ShopTitle(),
        actions: [HeaderWishlistButton(), HeaderCartButton()],
      ),
      body: BlocListener<StoreConfigCubit, StoreConfigState>(
        // The shop came back (its settings finally loaded after a failure):
        // reload the products too, rather than leaving the error on screen.
        listenWhen: (previous, current) => previous.status.isFailure && current.status.isSuccess,
        listener: (context, _) {
          final home = context.read<HomeBloc>();
          if (home.state.status.isFailure) home.add(const HomeRefreshed());
        },
        child: FailureSnackbarListener<HomeBloc, HomeState>(
          statusOf: (s) => s.status,
          messageOf: (s) => s.errorMessage,
          hasContent: (s) => !s.feed.isEmpty,
          child: BlocBuilder<HomeBloc, HomeState>(
            builder: (context, state) => StateView(
              status: state.status,
              isEmpty: state.feed.isEmpty,
              errorMessage: state.errorMessage,
              onRetry: () => _refresh(context),
              empty: const EmptyView(
                icon: Icons.storefront_outlined,
                title: CatalogStrings.emptyShopTitle,
                message: CatalogStrings.emptyShopMessage,
              ),
              builder: (_) => _HomeContent(state: state),
            ),
          ),
        ),
      ),
    );
  }
}

/// Pull to refresh and retry: the products, and the shop's settings too if
/// they never arrived (an app opened offline showed "Bakery" and no tagline
/// until restarted).
Future<void> _refresh(BuildContext context) async {
  final bloc = context.read<HomeBloc>()..add(const HomeRefreshed());
  unawaited(context.read<StoreConfigCubit>().loadIfNeeded());
  await bloc.stream.firstWhere((s) => !s.status.isLoading);
}

class _HomeContent extends StatelessWidget {
  const _HomeContent({required this.state});

  final HomeState state;

  /// The shop's own category and occasion names, for the search box's
  /// turning hint. Already downloaded: no request.
  static List<String> _hintWords(HomeFeed feed) {
    final catalog = feed.catalog;
    final groups = catalog.isEmpty
        ? [...feed.categories, ...feed.occasions]
        : [...catalog.categories, ...catalog.occasions];
    return [for (final group in groups) group.name];
  }

  @override
  Widget build(BuildContext context) {
    final feed = state.feed;
    final layout = state.layout;
    final hintWords = _hintWords(feed);
    if (!layout.isEmpty) {
      // THE SHOP'S OWN PAGE, as built in its Homepage Builder: the same
      // sections in the same order as the website, so one edit changes both.
      final index = HomeCatalogIndex(products: feed.allProducts, catalog: feed.catalog);
      return RefreshIndicator(
        onRefresh: () => _refresh(context),
        child: CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(child: DeliveryAreaBar()),
            SliverToBoxAdapter(child: SearchEntryBar(hintWords: hintWords)),
            // The website header's own menu, as icon tabs.
            SliverToBoxAdapter(
              child: HomeMenuTabs(items: layout.menu, index: index),
            ),
            SliverList.builder(
              itemCount: layout.sections.length,
              itemBuilder: (_, i) => HomeSectionView(
                key: ValueKey(layout.sections[i].id),
                section: layout.sections[i],
                index: index,
                recentSlugs: state.recentSlugs,
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xl)),
          ],
        ),
      );
    }

    // No published layout to read (an older shop, or it failed to load):
    // rows the app builds from the catalogue itself.
    return RefreshIndicator(
      onRefresh: () => _refresh(context),
      child: CustomScrollView(
        slivers: [
          const SliverToBoxAdapter(child: DeliveryAreaBar()),
          const SliverToBoxAdapter(child: HomeGreeting()),
          SliverToBoxAdapter(child: SearchEntryBar(hintWords: hintWords)),
          if (feed.categories.isNotEmpty)
            SliverToBoxAdapter(
              child: GroupStrip(
                title: CatalogStrings.shopByCategory,
                groups: feed.categories,
                onViewAll: () => context.go(AppRoutes.categories),
              ),
            ),
          if (feed.occasions.isNotEmpty)
            SliverToBoxAdapter(
              child: GroupStrip(title: CatalogStrings.shopByOccasion, groups: feed.occasions),
            ),
          for (final rail in feed.rails) SliverToBoxAdapter(child: ProductRailView(rail: rail)),
          if (feed.allProducts.isNotEmpty) ...[
            const SliverToBoxAdapter(child: SectionHeader(title: CatalogStrings.allProducts)),
            ProductSliverGrid(products: feed.allProducts),
          ],
          const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xl)),
        ],
      ),
    );
  }
}
