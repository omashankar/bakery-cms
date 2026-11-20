import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/app_loader.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../../core/widgets/error_view.dart';
import '../bloc/search/search_bloc.dart';
import '../bloc/search/search_event.dart';
import '../bloc/search/search_state.dart';
import '../../domain/entities/product.dart';
import '../../domain/services/listing_arranger.dart';
import '../bloc/listing_controls/listing_controls_cubit.dart';
import '../widgets/listing_bottom_bar.dart';
import '../widgets/search_field.dart';
import '../widgets/listing_products_sliver.dart';

class SearchPage extends StatelessWidget {
  const SearchPage({super.key, this.initialQuery = ''});

  final String initialQuery;

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (_) {
            final bloc = GetIt.I<SearchBloc>();
            if (initialQuery.isNotEmpty) bloc.add(SearchQueryChanged(initialQuery));
            return bloc;
          },
        ),
        // Kept across queries: a customer who chose "Price: low to high" keeps
        // it while refining the words.
        BlocProvider(create: (_) => GetIt.I<ListingControlsCubit>()),
      ],
      child: _SearchView(initialQuery: initialQuery),
    );
  }
}

class _SearchView extends StatelessWidget {
  const _SearchView({required this.initialQuery});

  final String initialQuery;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppAppBar(
        titleWidget: Padding(
          padding: const EdgeInsets.only(right: AppSpacing.lg),
          child: SearchField(
            initialQuery: initialQuery,
            autofocus: initialQuery.isEmpty,
            onChanged: (query) => context.read<SearchBloc>().add(SearchQueryChanged(query)),
          ),
        ),
      ),
      bottomNavigationBar: BlocSelector<SearchBloc, SearchState, List<Product>>(
        selector: (state) => state.hasQuery ? state.results : const [],
        builder: (_, results) => results.isEmpty
            ? const SizedBox.shrink()
            : ListingBottomBar(showRatingFilter: ListingArranger.hasRatings(results)),
      ),
      body: const _SearchResults(),
    );
  }
}

/// Search has its own four states: prompt (no query yet), loading, results or
/// none, and error.
class _SearchResults extends StatelessWidget {
  const _SearchResults();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SearchBloc, SearchState>(
      builder: (context, state) {
        if (!state.hasQuery) {
          return const EmptyView(
            icon: Icons.search,
            title: CatalogStrings.searchPrompt,
            message: CatalogStrings.searchPromptMessage,
          );
        }
        // While the next search runs, keep the last results on screen: a
        // loader on every keystroke made the grid flash in and out.
        if (state.status.isLoading && state.results.isEmpty) return const AppLoader();
        if (state.status.isFailure) {
          return ErrorView(
            message: state.errorMessage ?? '',
            onRetry: () => context.read<SearchBloc>().add(SearchQueryChanged(state.query)),
          );
        }
        if (state.results.isEmpty) {
          return const EmptyView(
            icon: Icons.search_off,
            title: CatalogStrings.searchNoResultsTitle,
            message: CatalogStrings.searchNoResultsMessage,
          );
        }
        return CustomScrollView(slivers: [ListingProductsSliver(products: state.results)]);
      },
    );
  }
}
