import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/strings/wishlist_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../../core/widgets/failure_snackbar_listener.dart';
import '../../../../core/widgets/page_heading.dart';
import '../../../../core/widgets/state_view.dart';
import '../../../catalog/presentation/widgets/product_sliver_grid.dart';
import '../bloc/wishlist_page_cubit.dart';
import '../bloc/wishlist_page_state.dart';
import '../../../catalog/presentation/widgets/header_cart_button.dart';
import '../../../catalog/presentation/widgets/header_search_button.dart';
import '../../../catalog/presentation/widgets/shop_title.dart';

/// The products saved on this phone, newest first.
class WishlistPage extends StatelessWidget {
  const WishlistPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.I<WishlistPageCubit>()..start(),
      child: const _WishlistView(),
    );
  }
}

class _WishlistView extends StatelessWidget {
  const _WishlistView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // The shop's brand, as on every shopping page; the page's name, with
      // its count, is its heading, as the website's "My Wishlist (3)".
      appBar: const AppAppBar(
        titleWidget: ShopTitle(),
        actions: [HeaderSearchButton(), HeaderCartButton()],
      ),
      body: FailureSnackbarListener<WishlistPageCubit, WishlistPageState>(
        statusOf: (s) => s.status,
        messageOf: (s) => s.errorMessage,
        hasContent: (s) => !s.isEmpty,
        child: BlocBuilder<WishlistPageCubit, WishlistPageState>(
          builder: (context, state) => StateView(
            status: state.status,
            isEmpty: state.isEmpty,
            errorMessage: state.errorMessage,
            onRetry: () => context.read<WishlistPageCubit>().retry(),
            empty: EmptyView(
              icon: Icons.favorite_border,
              title: WishlistStrings.emptyTitle,
              message: WishlistStrings.emptyMessage,
              actionLabel: WishlistStrings.startShopping,
              onAction: () => context.go(AppRoutes.home),
            ),
            builder: (_) =>
CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: PageHeading(WishlistStrings.heading(state.products.length)),
                ),
                ProductSliverGrid(products: state.products),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
