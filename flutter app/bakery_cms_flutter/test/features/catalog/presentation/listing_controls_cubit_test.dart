import 'package:bakery_cms_flutter/features/catalog/domain/entities/listing_filter.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/listing_sort.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/price_band.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/listing_controls/filter_draft_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/listing_controls/listing_controls_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/listing_controls/listing_controls_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const cheapInStock = ListingFilter(priceBands: {PriceBand.under500}, inStockOnly: true);

  group('ListingControlsCubit', () {
    test('starts on Popularity with no filter', () {
      final cubit = ListingControlsCubit();
      expect(cubit.state, const ListingControlsState());
      expect(cubit.state.sort, ListingSort.popularity);
      expect(cubit.state.filter.isEmpty, isTrue);
      cubit.close();
    });

    blocTest<ListingControlsCubit, ListingControlsState>(
      'sortBy changes the sort and keeps the filter',
      build: ListingControlsCubit.new,
      seed: () => const ListingControlsState(filter: cheapInStock),
      act: (cubit) => cubit.sortBy(ListingSort.priceHighToLow),
      expect: () => const [
        ListingControlsState(sort: ListingSort.priceHighToLow, filter: cheapInStock),
      ],
    );

    blocTest<ListingControlsCubit, ListingControlsState>(
      'applyFilter replaces the filter and keeps the sort',
      build: ListingControlsCubit.new,
      seed: () => const ListingControlsState(sort: ListingSort.priceLowToHigh),
      act: (cubit) => cubit.applyFilter(cheapInStock),
      expect: () => const [
        ListingControlsState(sort: ListingSort.priceLowToHigh, filter: cheapInStock),
      ],
    );

    blocTest<ListingControlsCubit, ListingControlsState>(
      'clearFilters drops every filter and keeps the sort',
      build: ListingControlsCubit.new,
      seed: () =>
          const ListingControlsState(sort: ListingSort.priceLowToHigh, filter: cheapInStock),
      act: (cubit) => cubit.clearFilters(),
      expect: () => const [ListingControlsState(sort: ListingSort.priceLowToHigh)],
    );
  });

  group('FilterDraftCubit', () {
    blocTest<FilterDraftCubit, ListingFilter>(
      'starts from the applied filter and toggles each choice',
      build: () => FilterDraftCubit(cheapInStock),
      act: (cubit) => cubit
        ..toggleBand(PriceBand.above2000)
        ..toggleBand(PriceBand.under500)
        ..toggleInStock()
        ..toggleFourStars(),
      expect: () => const [
        ListingFilter(priceBands: {PriceBand.under500, PriceBand.above2000}, inStockOnly: true),
        ListingFilter(priceBands: {PriceBand.above2000}, inStockOnly: true),
        ListingFilter(priceBands: {PriceBand.above2000}),
        ListingFilter(priceBands: {PriceBand.above2000}, fourStarAndAbove: true),
      ],
    );
  });
}
