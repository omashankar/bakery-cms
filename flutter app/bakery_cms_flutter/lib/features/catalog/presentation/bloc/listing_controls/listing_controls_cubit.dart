import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/entities/listing_filter.dart';
import '../../../domain/entities/listing_sort.dart';
import 'listing_controls_state.dart';

/// The sort and filter a customer chose on a listing or search page. The
/// products themselves stay where they were loaded; `ListingArranger` lays
/// them out from this.
class ListingControlsCubit extends Cubit<ListingControlsState> {
  ListingControlsCubit() : super(const ListingControlsState());

  void sortBy(ListingSort sort) => emit(state.copyWith(sort: sort));

  void applyFilter(ListingFilter filter) => emit(state.copyWith(filter: filter));

  void clearFilters() => emit(state.copyWith(filter: const ListingFilter()));
}
