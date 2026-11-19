import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../../core/widgets/failure_snackbar_listener.dart';
import '../../../../core/widgets/state_view.dart';
import '../../../delivery_area/presentation/widgets/delivery_area_bar.dart';
import '../../domain/entities/group_kind.dart';
import '../../domain/entities/product.dart';
import '../../domain/services/listing_arranger.dart';
import '../bloc/listing_controls/listing_controls_cubit.dart';
import '../bloc/product_list/product_list_cubit.dart';
import '../bloc/product_list/product_list_state.dart';
import '../widgets/listing_bottom_bar.dart';
import '../widgets/listing_products_sliver.dart';

/// Every product in one category, occasion or collection: where it is
/// delivered, the group's name and a line about it, a two-column grid, and
/// Sort by / Filter pinned at the bottom. Sorting and filtering rearrange the
/// products already loaded; neither asks the shop again.
class ProductListPage extends StatelessWidget {
  const ProductListPage({super.key, required this.kind, required this.slug});

  final GroupKind kind;
  final String slug;

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => GetIt.I<ProductListCubit>()..load(kind, slug)),
        BlocProvider(create: (_) => GetIt.I<ListingControlsCubit>()),
      ],
      child: const _ProductListView(),
    );
  }
}

class _ProductListView extends StatelessWidget {
  const _ProductListView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppAppBar(
        titleWidget: BlocSelector<ProductListCubit, ProductListState, String>(
          selector: (state) => state.listing?.group.name ?? '',
          builder: (_, name) => Text(name, overflow: TextOverflow.ellipsis),
        ),
      ),
      bottomNavigationBar: BlocSelector<ProductListCubit, ProductListState, List<Product>>(
        selector: (state) => state.listing?.products ?? const [],
        builder: (_, products) => products.isEmpty
            ? const SizedBox.shrink()
            : ListingBottomBar(showRatingFilter: ListingArranger.hasRatings(products)),
      ),
      body: Column(
        children: [
          // Pinned: whether the shop delivers here is the first thing a
          // gifting customer checks, on every state of the page.
          const DeliveryAreaBar(),
          Expanded(
            child: FailureSnackbarListener<ProductListCubit, ProductListState>(
              statusOf: (s) => s.status,
              messageOf: (s) => s.errorMessage,
              hasContent: (s) => !s.isEmpty,
              child: BlocBuilder<ProductListCubit, ProductListState>(
                builder: (context, state) => StateView(
                  status: state.status,
                  isEmpty: state.isEmpty,
                  errorMessage: state.errorMessage,
                  onRetry: () => context.read<ProductListCubit>().refresh(),
                  empty: const EmptyView(
                    icon: Icons.cake_outlined,
                    title: CatalogStrings.emptyGroupTitle,
                    message: CatalogStrings.emptyGroupMessage,
                  ),
                  builder: (_) {
                    final listing = state.listing!;
                    final group = listing.group;
                    return RefreshIndicator(
                      onRefresh: () => context.read<ProductListCubit>().refresh(),
                      child: CustomScrollView(
                        slivers: [
                          ListingProductsSliver(
                            products: listing.products,
                            title: group.name,
                            blurb: group.headline.isNotEmpty ? group.headline : group.description,
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
